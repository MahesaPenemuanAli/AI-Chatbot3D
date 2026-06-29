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
        Schema::create('avatars', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('model_url'); // URL to GLB (Ready Player Me) or VRM (VRoid)
            $table->string('voice_id')->nullable(); // ElevenLabs/TTS voice ID
            $table->text('personality_prompt')->nullable(); // System instruction for this avatar
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('avatars');
    }
};
