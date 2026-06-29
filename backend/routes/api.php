<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;

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
