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
        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_message_id')->constrained()->cascadeOnDelete();
            $table->string('attachment_type'); // image, video, audio, document
            $table->string('file_path'); // Path in storage
            $table->string('file_name'); // Original file name
            $table->string('mime_type');
            $table->integer('file_size'); // In bytes
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('message_attachments');
    }
};
