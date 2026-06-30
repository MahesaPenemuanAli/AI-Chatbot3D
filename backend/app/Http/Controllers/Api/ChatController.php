<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatSession;
use App\Models\ChatMessage;
use App\Models\MessageAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ChatController extends Controller
{
    protected const SYSTEM_INSTRUCTION = 'Kamu adalah "TripMate AI", asisten AI pemandu pariwisata Indonesia yang hangat, ramah, dan sangat ahli dalam memberikan panduan wisata, sejarah, budaya, kuliner, dan rencana perjalanan (itinerary).

Tugas utama kamu:
1. Menjawab pertanyaan pengguna tentang destinasi wisata di Indonesia dengan jelas, sopan, dan ramah.
2. Memberikan penjelasan yang informatif, menarik, dan terstruktur menggunakan format markdown (seperti tebal/bold, poin-poin untuk daftar, dan penomoran untuk langkah kerja).
3. Jika pengguna mengunggah gambar atau video destinasi wisata, makanan khas, atau peta, analisislah gambar tersebut dengan cerdas dan berikan informasi kontekstual yang kaya tentang apa yang ada di dalamnya.
4. Jika pengguna mengirimkan pesan suara, dengarkan dan tanggapi pesan tersebut dengan penuh keramahan.
5. Selalu rekomendasikan tempat wisata terbaik, kuliner legendaris, tips perjalanan, serta rincian itinerary yang dipersonalisasi berdasarkan preferensi pengguna.';

    public function sendMessage(Request $request, $sessionId)
    {
        $request->validate([
            'message' => ['nullable', 'string'],
            'model' => ['nullable', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['file', 'max:20480'],
        ]);

        $user = $request->user();
        $userMessageText = trim($request->message ?? '');
        $selectedModel = $request->model ?? 'gemini-2.5-flash';

        $chatSession = ChatSession::firstOrCreate(
            ['id' => $sessionId],
            [
                'user_id' => $user->id,
                'title' => $userMessageText ? (strlen($userMessageText) > 30 ? substr($userMessageText, 0, 30) . '...' : $userMessageText) : 'Unggahan Media Wisata',
                'model' => $selectedModel,
            ]
        );

        $hasAttachments = $request->hasFile('attachments');
        $messageType = 'text';
        if ($hasAttachments) {
            $messageType = 'multimodal';
        }

        $userMessage = $chatSession->messages()->create([
            'role' => 'user',
            'message_type' => $messageType,
            'content' => $userMessageText,
        ]);

        $attachmentsData = [];
        if ($hasAttachments) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store('attachments', 'public');
                $attachmentType = 'image';
                $mimeType = $file->getMimeType();

                if (str_starts_with($mimeType, 'video/')) {
                    $attachmentType = 'video';
                } elseif (str_starts_with($mimeType, 'audio/')) {
                    $attachmentType = 'audio';
                }

                $attachment = $userMessage->attachments()->create([
                    'attachment_type' => $attachmentType,
                    'file_path' => 'storage/' . $path,
                    'file_name' => $file->getClientOriginalName(),
                    'mime_type' => $mimeType,
                    'file_size' => $file->getSize(),
                ]);

                $attachmentsData[] = $attachment;
            }
        }

        $historyMessages = $chatSession->messages()->with('attachments')->orderBy('created_at', 'asc')->get();
        $contents = [];

        foreach ($historyMessages as $msg) {
            $parts = [];
            
            if ($msg->content) {
                $parts[] = ['text' => $msg->content];
            }

            if ($msg->id === $userMessage->id) {
                foreach ($attachmentsData as $att) {
                    $cleanPath = str_replace('storage/', '', $att->file_path);
                    if (Storage::disk('public')->exists($cleanPath)) {
                        $fileData = base64_encode(Storage::disk('public')->get($cleanPath));
                        $parts[] = [
                          'inlineData' => [
                            'mimeType' => $att->mime_type,
                            'data' => $fileData
                          ]
                        ];
                    }
                }
            } else {
                foreach ($msg->attachments as $att) {
                    $cleanPath = str_replace('storage/', '', $att->file_path);
                    if (Storage::disk('public')->exists($cleanPath)) {
                        $fileData = base64_encode(Storage::disk('public')->get($cleanPath));
                        $parts[] = [
                          'inlineData' => [
                            'mimeType' => $att->mime_type,
                            'data' => $fileData
                          ]
                        ];
                    }
                }
            }

            if (!empty($parts)) {
                $contents[] = [
                    'role' => $msg->role === 'assistant' ? 'model' : $msg->role,
                    'parts' => $parts
                ];
            }
        }

        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json([
                'response' => 'GEMINI_API_KEY is not set in the server .env file.'
            ], 500);
        }

        try {
            [$responseText, $usedModel] = $this->generateChatWithFallback($contents, $apiKey);

            if ($chatSession->model !== $usedModel) {
                $chatSession->update(['model' => $usedModel]);
            }

            $aiMessage = $chatSession->messages()->create([
                'role' => 'model',
                'message_type' => 'text',
                'content' => $responseText,
            ]);

            return response()->json([
                'user_message' => [
                    'id' => $userMessage->id,
                    'role' => 'user',
                    'content' => $userMessage->content,
                    'created_at' => $userMessage->created_at,
                    'attachments' => $attachmentsData
                ],
                'ai_message' => [
                    'id' => $aiMessage->id,
                    'role' => 'assistant',
                    'content' => $aiMessage->content,
                    'created_at' => $aiMessage->created_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Gemini API Integration Error: ' . $e->getMessage());
            
            return response()->json([
                'response' => 'Maaf, asisten pariwisata sedang sangat sibuk. Silakan kirim ulang pesan Anda beberapa detik lagi. (Detail: ' . $e->getMessage() . ')',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    protected function generateChatWithFallback(array $contents, string $apiKey): array
    {
        $models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
        $lastError = null;

        foreach ($models as $model) {
            for ($attempt = 0; $attempt < 2; $attempt++) {
                try {
                    Log::info("Trying to contact Gemini model '{$model}' (attempt " . ($attempt + 1) . ")...");
                    
                    $response = Http::withHeaders([
                        'Content-Type' => 'application/json',
                    ])->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                        'contents' => $contents,
                        'systemInstruction' => [
                            'parts' => [
                                ['text' => self::SYSTEM_INSTRUCTION]
                            ]
                        ],
                        'generationConfig' => [
                            'temperature' => 0.7,
                            'topP' => 0.95,
                        ]
                    ]);

                    if ($response->successful()) {
                        $data = $response->json();
                        $responseText = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                        
                        if ($responseText) {
                            Log::info("Successfully generated response using model '{$model}'!");
                            return [$responseText, $model];
                        }
                    }

                    if ($response->status() === 429 || $response->status() === 503) {
                        Log::warning("Gemini model '{$model}' returned status " . $response->status() . ". Retrying...");
                        usleep(1500000 * ($attempt + 1));
                        continue;
                    }

                    $lastError = new \Exception("Gemini API Error (Model: {$model}, Status: " . $response->status() . "): " . $response->body());
                    break;

                } catch (\Exception $e) {
                    $lastError = $e;
                    Log::error("Unexpected error with model '{$model}': " . $e->getMessage());
                }
            }
        }

        throw $lastError ?: new \Exception("Semua model Gemini sedang mengalami gangguan.");
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

        $messages = $session->messages()->with('attachments')->orderBy('created_at', 'asc')->get();

        $formattedMessages = $messages->map(function ($msg) {
            return [
                'id' => $msg->id,
                'role' => $msg->role === 'model' ? 'assistant' : $msg->role,
                'content' => $msg->content,
                'created_at' => $msg->created_at,
                'attachments' => $msg->attachments->map(function ($att) {
                    return [
                        'id' => $att->id,
                        'attachment_type' => $att->attachment_type,
                        'file_path' => $att->file_path,
                        'file_name' => $att->file_name,
                        'mime_type' => $att->mime_type,
                        'file_size' => $att->file_size,
                    ];
                })
            ];
        });

        return response()->json($formattedMessages);
    }

    public function deleteSession(Request $request, $id)
    {
        $session = ChatSession::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $session->delete();

        return response()->json([
            'message' => 'Session deleted successfully'
        ]);
    }
}
