<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Avatar extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'model_url',
        'voice_id',
        'personality_prompt',
    ];

    /**
     * Get the animations mapped to this avatar.
     */
    public function animations(): HasMany
    {
        return $this->hasMany(AvatarAnimation::class);
    }

    /**
     * Get the chat sessions using this avatar.
     */
    public function chatSessions(): HasMany
    {
        return $this->hasMany(ChatSession::class);
    }
}
