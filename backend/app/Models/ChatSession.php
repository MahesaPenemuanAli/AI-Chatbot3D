<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'id', // Matches frontend session ID
        'user_id',
        'avatar_id',
        'title',
        'model',
    ];

    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * Get the user that owns the chat session.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the avatar used in this chat session.
     */
    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Avatar::class);
    }

    /**
     * Get the messages for the chat session.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class)->orderBy('created_at', 'asc');
    }
}
