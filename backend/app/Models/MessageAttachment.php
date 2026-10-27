<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class MessageAttachment extends Model
{
    use HasFactory;

    public const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/x-flac',
        'video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime', 'video/3gpp',
    ];

    /** Resolve only known attachment paths; never accept traversal or arbitrary disks. */
    public function storageLocation(): array
    {
        abort_unless(preg_match('#^(private|storage)/attachments/[a-zA-Z0-9/_\.-]+$#', $this->file_path)
            && ! in_array('..', explode('/', $this->file_path), true), 404);

        return [str_starts_with($this->file_path, 'private/') ? 'local' : 'public', substr($this->file_path, strpos($this->file_path, '/') + 1)];
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'attachment_type' => $this->attachment_type,
            'file_path' => $this->file_path,
            'file_name' => $this->file_name,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            // Laravel signs/verifies paths without the request base directory.
            'download_url' => request()->getBaseUrl().URL::temporarySignedRoute('chat.attachments.download', now()->addMinutes(15), ['attachment' => $this->id], absolute: false),
        ];
    }

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
