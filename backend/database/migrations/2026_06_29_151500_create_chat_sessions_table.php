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
        Schema::create('chat_sessions', function (Blueprint $table) {
            $table->string('id')->primary(); // UUID or custom string from frontend
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('avatar_id')->nullable()->constrained()->nullOnDelete(); // The 3D avatar used in this session
            $table->string('title');
            $table->string('model');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_sessions');
    }
};
