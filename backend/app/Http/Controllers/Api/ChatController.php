<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatSession;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    // Injected system instruction from your Flask app
    protected const SYSTEM_INSTRUCTION = 'Kamu adalah "HerbaBot", asisten AI yang hangat, ramah, dan sangat ahli dalam dunia minuman tradisional Indonesia (herbal/jamu).

Tugas utama kamu:
1. Menjawab pertanyaan pengguna tentang minuman tradisional, resepnya, bahan-bahannya, cara pembuatannya, serta manfaat kesehatannya dengan jelas, sopan, dan ramah dalam Bahasa Indonesia yang santun.
2. Memberikan penjelasan yang informatif, menarik, dan terstruktur. Gunakan format yang cantik (seperti tebal/bold, poin-poin untuk bahan, dan penomoran untuk langkah kerja) agar nyaman dibaca. Jangan menggunakan emoji secara berlebihan untuk menjaga estetika modern.
3. Selalu siap sedia merekomendasikan minuman tradisional berdasarkan keluhan kesehatan pengguna. Misalnya, jika mereka mengeluh pegal, masuk angin, kembung, atau lelah, rekomendasikan minuman tradisional yang sesuai dari basis data Anda.
4. Kamu sangat fleksibel: pengguna bisa bertanya dengan gaya bahasa kasual, salah mengetik (typo), atau mencari minuman dengan nama yang mirip. Cukup pahami maksud mereka secara cerdas tanpa menolak atau memaksakan format yang kaku.
5. Jika pengguna menanyakan hal di luar minuman tradisional, bahan jamu/herbal, atau kesehatan alami, responlah dengan sopan bahwa kamu hanya dikhususkan untuk membantu menjelaskan minuman tradisional dan resepnya, lalu arahkan kembali pembicaraan ke topik jamu tradisional.';

    /**
     * Send a message to the AI and get a response.
     */
    public function sendMessage(Request $request, $sessionId)
    {
        $request->validate([
            'message' => ['required', 'string'],
            'model' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $userMessageText = trim($request->message);
        $selectedModel = $request->model ?? 'gemini-2.5-flash';

        // 1. Get or create the chat session in database
        $chatSession = ChatSession::firstOrCreate(
            ['id' => $sessionId],
            [
                'user_id' => $user->id,
                'title' => strlen($userMessageText) > 30 ? substr($userMessageText, 0, 30) . '...' : $userMessageText,
                'model' => $selectedModel,
            ]
        );

        // 2. Save the user message to the database
        $userMessage = $chatSession->messages()->create([
            'role' => 'user',
            'content' => $userMessageText,
        ]);

        // 3. Retrieve chat history from database and format for Gemini API
        // Gemini expects: [ { "role": "user"|"model", "parts": [ { "text": "..." } ] } ]
        $historyMessages = $chatSession->messages;
        $contents = [];
        foreach ($historyMessages as $msg) {
            $contents[] = [
                'role' => $msg->role, // 'user' or 'model'
                'parts' => [
                    ['text' => $msg->content]
                ]
            ];
        }

        // 4. Call Gemini API with fallback and retry logic
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json([
                'response' => 'GEMINI_API_KEY is not set in the server .env file.'
            ], 500);
        }

        try {
            [$responseText, $usedModel] = $this->generateChatWithFallback($contents, $apiKey);

            // Update session model if different model was used as fallback
            if ($chatSession->model !== $usedModel) {
                $chatSession->update(['model' => $usedModel]);
            }

            // 5. Save the AI response to the database
            $aiMessage = $chatSession->messages()->create([
                'role' => 'model',
                'content' => $responseText,
            ]);

            // 6. Return response matching frontend structure
            return response()->json([
                'user_message' => [
                    'id' => $userMessage->id,
                    'role' => 'user',
                    'content' => $userMessage->content,
                    'created_at' => $userMessage->created_at,
                ],
                'ai_message' => [
                    'id' => $aiMessage->id,
                    'role' => 'assistant', // Map 'model' to 'assistant' for the React frontend
                    'content' => $aiMessage->content,
                    'created_at' => $aiMessage->created_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Gemini API Integration Error: ' . $e->getMessage());
            
            return response()->json([
                'response' => 'Maaf, asisten herbal sedang sangat sibuk. Silakan kirim ulang pesan Anda beberapa detik lagi. (Detail: ' . $e->getMessage() . ')',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Tries to generate chat content using gemini-2.5-flash.
     * If 503 UNAVAILABLE or 429 RATE_LIMIT is hit, it retries with backoff.
     * If it continues to fail, it tries gemini-2.0-flash and gemini-1.5-flash as fallbacks.
     */
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

                    // Handle 429 (Rate Limit) or 503 (Service Unavailable) with exponential backoff
                    if ($response->status() === 429 || $response->status() === 503) {
                        Log::warning("Gemini model '{$model}' returned status " . $response->status() . ". Retrying...");
                        usleep(1500000 * ($attempt + 1)); // 1.5s, then 3.0s
                        continue;
                    }

                    // Other error, try the next model
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

    /**
     * List all chat sessions for the authenticated user.
     */
    public function listSessions(Request $request)
    {
        $sessions = ChatSession::where('user_id', $request->user()->id)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($sessions);
    }

    /**
     * Get all messages in a specific chat session.
     */
    public function getSessionMessages(Request $request, $id)
    {
        $session = ChatSession::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $messages = $session->messages()->orderBy('created_at', 'asc')->get();

        // Map roles to match the frontend expectations ('model' -> 'assistant')
        $formattedMessages = $messages->map(function ($msg) {
            return [
                'id' => $msg->id,
                'role' => $msg->role === 'model' ? 'assistant' : $msg->role,
                'content' => $msg->content,
                'created_at' => $msg->created_at,
            ];
        });

        return response()->json($formattedMessages);
    }

    /**
     * Delete a specific chat session.
     */
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
