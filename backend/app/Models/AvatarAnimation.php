<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AvatarAnimation extends Model
{
    use HasFactory;

    protected $fillable = [
        'avatar_id',
        'emotion',
        'animation_url',
        'loop',
    ];

    protected $casts = [
        'loop' => 'boolean',
    ];

    /**
     * Get the avatar that owns the animation.
     */
    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Avatar::class);
    }
}
