<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->string('chat_session_id');
            $table->foreign('chat_session_id')->references('id')->on('chat_sessions')->cascadeOnDelete();
            $table->string('role'); // user, model, system
            $table->string('message_type')->default('text'); // text, audio, image, video, multimodal
            $table->text('content')->nullable(); // Text message or transcription of audio
            $table->string('audio_url')->nullable(); // Path to TTS voice output or recorded audio input
            $table->integer('duration')->nullable(); // Audio duration in seconds
            $table->json('metadata')->nullable(); // Emotional cues, blendshapes, visemes, etc.
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
