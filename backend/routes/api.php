<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Services\GeminiChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/status', function (GeminiChatService $chat) {
    $configured = $chat->configured();

    return response()->json([
        'provider' => 'gemini',
        'configured' => $configured,
        'code' => $configured ? 'AI_CONFIGURED' : 'AI_NOT_CONFIGURED',
        'message' => $configured
            ? 'Layanan AI telah dikonfigurasi.'
            : 'Layanan AI belum dikonfigurasi di server. Tambahkan GEMINI_API_KEY melalui pengaturan lingkungan.',
    ]);
});

// Public Auth Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::post('/logout', [AuthController::class, 'logout']);

    // Chat Routes
    Route::get('/chat/sessions', [ChatController::class, 'listSessions']);
    Route::get('/chat/sessions/{id}/messages', [ChatController::class, 'getSessionMessages']);
    Route::post('/chat/sessions/{id}/messages', [ChatController::class, 'sendMessage']);
    Route::delete('/chat/sessions/{id}', [ChatController::class, 'deleteSession']);
});
