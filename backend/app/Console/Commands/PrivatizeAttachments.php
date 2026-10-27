<?php

namespace App\Console\Commands;

use App\Models\MessageAttachment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PrivatizeAttachments extends Command
{
    protected $signature = 'attachments:privatize {--apply : Move legacy public uploads; without this flag only report}';

    protected $description = 'Audit or migrate legacy public chat attachments to private storage';

    public function handle(): int
    {
        $count = 0;
        $failures = 0;
        foreach (MessageAttachment::where('file_path', 'like', 'storage/attachments/%')->lazyById() as $attachment) {
            $count++;
            $target = null;
            try {
                [, $source] = $attachment->storageLocation();
                if (! Storage::disk('public')->exists($source)) {
                    throw new \RuntimeException('Legacy source file is missing.');
                }
                if (! $this->option('apply')) {
                    continue;
                }
                // Unique destination avoids replacing any existing private file.
                $target = 'attachments/'.bin2hex(random_bytes(20)).'.'.pathinfo($source, PATHINFO_EXTENSION);
                $content = Storage::disk('public')->get($source);
                if (! Storage::disk('local')->put($target, $content)
                    || ! hash_equals(hash('sha256', $content), hash('sha256', Storage::disk('local')->get($target)))) {
                    throw new \RuntimeException('Private copy could not be verified.');
                }
                DB::transaction(function () use ($attachment, $target, $source) {
                    $attachment->update(['file_path' => 'private/'.$target]);
                    if (! Storage::disk('public')->delete($source)) {
                        throw new \RuntimeException('Legacy public copy could not be removed.');
                    }
                });
            } catch (\Throwable $exception) {
                $failures++;
                // Keep a verified private copy if the DB or source deletion failed;
                // removing it could discard the only remaining copy after a commit error.
                $this->error('Attachment '.$attachment->id.': migration incomplete; retain backups and inspect storage.');
                report($exception);
            }
        }
        $this->info(($this->option('apply') ? 'Migration' : 'Dry run').": {$count} legacy attachment(s), {$failures} problem(s).");
        if (! $this->option('apply')) {
            $this->comment('No files or database rows changed. Back up the database/storage before using --apply.');
        }

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
