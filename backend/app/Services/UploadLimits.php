<?php

namespace App\Services;

class UploadLimits
{
    public static function current(): array
    {
        return self::fromSettings((string) ini_get('upload_max_filesize'), (string) ini_get('post_max_size'), filter_var(ini_get('file_uploads'), FILTER_VALIDATE_BOOLEAN) ? (int) ini_get('max_file_uploads') : 0);
    }

    public static function fromSettings(string $fileSize, string $postSize, int $fileCount): array
    {
        $applicationLimit = 20 * 1024 * 1024;
        $fileLimit = self::bytes($fileSize);
        $postLimit = self::bytes($postSize);
        // Leave room for multipart boundaries, names, text, and other form fields.
        $totalLimit = min($applicationLimit, $postLimit > 0 ? max(0, $postLimit - 256 * 1024) : $applicationLimit);

        return [
            'max_attachment_bytes' => min($totalLimit, $fileLimit > 0 ? $fileLimit : $applicationLimit),
            'max_total_attachment_bytes' => $totalLimit,
            'max_attachment_count' => min(4, max(0, $fileCount)),
        ];
    }

    public static function bytes(string $value): int
    {
        $value = trim($value);
        $unit = strtolower(substr($value, -1));
        $power = array_search($unit, ['k', 'm', 'g', 't'], true);

        return (int) min(PHP_INT_MAX, max(0, (float) $value * ($power === false ? 1 : 1024 ** ($power + 1))));
    }
}
