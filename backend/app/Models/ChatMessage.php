<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'chat_session_id',
        'role', // 'user' or 'model'
        'message_type', // 'text', 'audio', 'image', 'video', 'multimodal'
        'content', // text content or transcript
        'audio_url', // path to TTS audio or voice recording
        'duration', // audio duration in seconds
        'metadata', // visemes, facial expressions, emotional cues
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    /**
     * Get the chat session that owns the message.
     */
    public function chatSession(): BelongsTo
    {
        return $this->belongsTo(ChatSession::class);
    }

    /**
     * Get the media attachments for this message.
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
