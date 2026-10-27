<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ChatServiceException;
use App\Http\Controllers\Controller;
use App\Models\ChatSession;
use App\Models\MessageAttachment;
use App\Services\GeminiChatService;
use App\Services\UploadLimits;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ChatController extends Controller
{
    protected const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
    protected const MAX_HISTORY_MESSAGES = 20;

    protected const SYSTEM_INSTRUCTION = 'Kamu adalah "Nusa AI", teman perjalanan virtual dan asisten AI pemandu pariwisata Indonesia yang hangat, ramah, dan sangat ahli dalam memberikan panduan wisata, sejarah, budaya, kuliner, dan rencana perjalanan (itinerary).

Tugas utama kamu:
1. Menjawab pertanyaan pengguna tentang destinasi wisata di Indonesia dengan jelas, sopan, dan ramah.
2. Memberikan penjelasan yang informatif, menarik, dan terstruktur menggunakan format markdown (seperti tebal/bold, poin-poin untuk daftar, dan penomoran untuk langkah kerja).
3. Jika pengguna mengunggah gambar atau video destinasi wisata, makanan khas, atau peta, analisislah gambar tersebut dengan cerdas dan berikan informasi kontekstual yang kaya tentang apa yang ada di dalamnya.
4. Jika pengguna mengirimkan pesan suara, dengarkan dan tanggapi pesan tersebut dengan penuh keramahan.
5. Selalu rekomendasikan tempat wisata terbaik, kuliner legendaris, tips perjalanan, serta rincian itinerary yang dipersonalisasi berdasarkan preferensi pengguna.';

    public function sendMessage(Request $request, string $sessionId, GeminiChatService $chat)
    {
        $limits = UploadLimits::current();
        $request->validate([
            'message' => ['nullable', 'string', 'max:12000'],
            'attachments' => ['nullable', 'array', 'max:'.$limits['max_attachment_count']],
            'attachments.*' => ['file', 'max:20480', 'mimetypes:'.implode(',', MessageAttachment::ALLOWED_MIME_TYPES)],
        ]);

        $user = $request->user();
        $text = trim((string) $request->input('message', ''));
        $files = $request->file('attachments', []) ?? [];
        if (array_sum(array_map(fn ($file) => $file->getSize(), $files)) > $limits['max_total_attachment_bytes']) {
            throw ValidationException::withMessages(['attachments' => 'Ukuran total lampiran melebihi batas unggahan server.']);
        }
        foreach ($files as $file) {
            if ($file->getSize() > $limits['max_attachment_bytes']) {
                throw ValidationException::withMessages(['attachments' => 'Ukuran berkas melebihi batas unggahan server.']);
            }
            if (strlen($file->getClientOriginalName()) > 255) {
                throw ValidationException::withMessages(['attachments' => 'Nama berkas terlalu panjang (maksimal 255 byte).']);
            }
        }
        if (strlen($sessionId) > 255) {
            throw ValidationException::withMessages(['session' => 'ID percakapan terlalu panjang.']);
        }
        $chatSession = ChatSession::find($sessionId);

        // Check ownership before configuration or provider work, including failed turns.
        abort_if($chatSession && (string) $chatSession->user_id !== (string) $user->id, 404);
        if ($text === '' && $files === []) {
            throw ValidationException::withMessages([
                'message' => 'Tulis pesan atau tambahkan lampiran sebelum mengirim.',
            ]);
        }

        $contents = [];
        $remainingMediaBytes = self::MAX_ATTACHMENT_BYTES - array_sum(array_map(fn ($file) => $file->getSize(), $files));
        if ($chatSession) {
            // Keep the archive intact, but bound provider payload and memory per request.
            $history = $chatSession->messages()->with('attachments')->reorder()->orderByDesc('id')->limit(self::MAX_HISTORY_MESSAGES)->get();
            foreach ($history as $message) {
                $parts = [];
                if ($message->content !== null && $message->content !== '') {
                    $parts[] = ['text' => $message->content];
                }
                foreach ($message->attachments as $attachment) {
                    [$disk, $path] = $attachment->storageLocation();
                    if (in_array($attachment->mime_type, MessageAttachment::ALLOWED_MIME_TYPES, true)
                        && Storage::disk($disk)->exists($path)
                        && ($bytes = Storage::disk($disk)->size($path)) <= $remainingMediaBytes) {
                        $remainingMediaBytes -= $bytes;
                        $parts[] = ['inlineData' => [
                            'mimeType' => $attachment->mime_type,
                            'data' => base64_encode(Storage::disk($disk)->get($path)),
                        ]];
                    } else {
                        $parts[] = ['text' => '[Lampiran lama tidak disertakan; minta pengguna mengunggah ulang jika diperlukan.]'];
                    }
                }
                if ($parts !== []) {
                    $contents[] = [
                        'role' => in_array($message->role, ['model', 'assistant'], true) ? 'model' : 'user',
                        'parts' => $parts,
                    ];
                }
            }
            $contents = array_reverse($contents);
        }

        $parts = $text !== '' ? [['text' => $text]] : [];
        foreach ($files as $file) {
            $parts[] = ['inlineData' => [
                'mimeType' => $file->getMimeType() ?? 'application/octet-stream',
                'data' => base64_encode($file->getContent()),
            ]];
        }
        $contents[] = ['role' => 'user', 'parts' => $parts];

        try {
            [$responseText, $usedModel] = $chat->generate($contents, self::SYSTEM_INSTRUCTION);
        } catch (ChatServiceException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'response' => $exception->getMessage(),
                'code' => $exception->errorCode,
                'retryable' => $exception->retryable,
            ], $exception->status);
        }

        // Persist a complete turn only after a genuine provider reply. Failed requests
        // leave no duplicate messages or uploads, and do not hold a DB lock while waiting.
        $storedPaths = [];
        try {
            [$userMessage, $aiMessage, $attachments] = DB::transaction(function () use (
                $chatSession, $sessionId, $user, $text, $files, $responseText, $usedModel, &$storedPaths,
            ) {
                $session = $chatSession ?? ChatSession::create([
                    'id' => $sessionId,
                    'user_id' => $user->id,
                    'title' => $text !== '' ? mb_strimwidth($text, 0, 60, '...') : 'Unggahan Media Wisata',
                    'model' => $usedModel,
                ]);
                $userMessage = $session->messages()->create([
                    'role' => 'user',
                    'message_type' => $files !== [] ? 'multimodal' : 'text',
                    'content' => $text,
                ]);
                $attachments = [];
                foreach ($files as $file) {
                    $path = $file->store('attachments', 'local');
                    if (! $path) {
                        throw new \RuntimeException('Cannot store chat attachment.');
                    }
                    $storedPaths[] = $path;
                    $mimeType = $file->getMimeType() ?? 'application/octet-stream';
                    $type = str_starts_with($mimeType, 'video/') ? 'video'
                        : (str_starts_with($mimeType, 'audio/') ? 'audio' : 'image');
                    $attachments[] = $userMessage->attachments()->create([
                        'attachment_type' => $type,
                        'file_path' => 'private/'.$path,
                        'file_name' => $file->getClientOriginalName(),
                        'mime_type' => $mimeType,
                        'file_size' => $file->getSize(),
                    ]);
                }
                $aiMessage = $session->messages()->create([
                    'role' => 'model',
                    'message_type' => 'text',
                    'content' => $responseText,
                ]);
                $session->forceFill(['model' => $usedModel])->touch();

                return [$userMessage, $aiMessage, $attachments];
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'user_message' => [
                'id' => $userMessage->id,
                'role' => 'user',
                'content' => $userMessage->content,
                'created_at' => $userMessage->created_at,
                'attachments' => array_map(fn ($attachment) => $attachment->toApiArray(), $attachments),
            ],
            'ai_message' => [
                'id' => $aiMessage->id,
                'role' => 'assistant',
                'content' => $aiMessage->content,
                'created_at' => $aiMessage->created_at,
            ],
        ]);
    }

    public function listSessions(Request $request)
    {
        $sessions = ChatSession::where('user_id', $request->user()->id)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($sessions);
    }

    public function getSessionMessages(Request $request, $id)
    {
        $session = ChatSession::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $messages = $session->messages()->with('attachments')->reorder()->orderBy('created_at')->orderBy('id')->get();

        $formattedMessages = $messages->map(function ($msg) {
            return [
                'id' => $msg->id,
                'role' => $msg->role === 'model' ? 'assistant' : $msg->role,
                'content' => $msg->content,
                'created_at' => $msg->created_at,
                'attachments' => $msg->attachments->map(fn ($att) => $att->toApiArray()),
            ];
        });

        return response()->json($formattedMessages);
    }

    public function deleteSession(Request $request, $id)
    {
        $session = ChatSession::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        // Delete only paths owned by this session, including legacy public uploads.
        foreach ($session->messages()->with('attachments')->get() as $message) {
            foreach ($message->attachments as $attachment) {
                [$disk, $path] = $attachment->storageLocation();
                abort_unless(Storage::disk($disk)->delete($path), 503, 'Lampiran belum dapat dihapus. Coba lagi.');
            }
        }
        $session->delete();

        return response()->json([
            'message' => 'Session deleted successfully',
        ]);
    }

    public function downloadAttachment(MessageAttachment $attachment)
    {
        // Preserve previews of legacy passive images even when the AI cannot ingest them.
        abort_unless(in_array($attachment->mime_type, [...MessageAttachment::ALLOWED_MIME_TYPES, 'image/gif', 'image/avif'], true), 404);
        [$disk, $path] = $attachment->storageLocation();
        abort_unless(Storage::disk($disk)->exists($path), 404);

        return Storage::disk($disk)->response($path, $attachment->file_name, [
            'Content-Type' => $attachment->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Referrer-Policy' => 'no-referrer',
        ], 'inline');
    }
}
