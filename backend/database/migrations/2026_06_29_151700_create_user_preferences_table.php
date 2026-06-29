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
        Schema::create('user_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('theme')->default('dark');
            $table->boolean('enable_voice_output')->default(true);
            $table->boolean('enable_3d_avatar')->default(true);
            $table->string('preferred_voice_id')->nullable();
            $table->string('preferred_language')->default('id'); // 'id' for Indonesian, 'en' for English
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
