<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'chat_message_id',
        'attachment_type',
        'file_path',
        'file_name',
        'mime_type',
        'file_size',
    ];

    /**
     * Get the message that owns this attachment.
     */
    public function chatMessage(): BelongsTo
    {
        return $this->belongsTo(ChatMessage::class);
    }
}
