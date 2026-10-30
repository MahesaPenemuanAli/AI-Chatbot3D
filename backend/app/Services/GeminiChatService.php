<?php

namespace App\Services;

use App\Exceptions\ChatServiceException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiChatService
{
    // Keep every provider attempt inside one deadline, below the browser's 65s
    // request timeout. On Windows, PHP also counts time spent waiting on cURL.
    protected const PROVIDER_TIMEOUT = 40;
    protected const TOTAL_PROVIDER_TIMEOUT = 45;
    protected const PHP_EXECUTION_BUDGET = 60;
    protected const PRIMARY_COOLDOWN_SECONDS = 60;

    public function configured(): bool
    {
        return trim((string) config('services.gemini.key')) !== '';
    }

    public function model(): string
    {
        return trim((string) config('services.gemini.model', 'gemini-3.5-flash-lite'));
    }

    public function generate(array $contents, string $instruction): array
    {
        $key = trim((string) config('services.gemini.key'));
        if ($key === '') {
            throw new ChatServiceException('Layanan AI belum dikonfigurasi di server. Tambahkan GEMINI_API_KEY melalui pengaturan lingkungan.', 'AI_NOT_CONFIGURED');
        }

        $primaryModel = $this->model();
        $fallbackModel = trim((string) config('services.gemini.fallback_model', ''));
        if (! preg_match('/^[a-zA-Z0-9._-]+$/D', $primaryModel)
            || ($fallbackModel !== '' && ! preg_match('/^[a-zA-Z0-9._-]+$/D', $fallbackModel))) {
            throw new ChatServiceException('Nama model AI pada server belum valid. Periksa GEMINI_MODEL dan GEMINI_FALLBACK_MODEL.', 'AI_MODEL_CONFIGURATION');
        }
        $hasFallback = $fallbackModel !== '' && $fallbackModel !== $primaryModel;
        $models = array_values(array_unique(array_filter([$primaryModel, $fallbackModel])));
        $primaryTimeout = (int) config('services.gemini.primary_timeout_seconds', 12);
        if ($primaryTimeout < 1 || $primaryTimeout > self::PROVIDER_TIMEOUT) {
            throw new ChatServiceException('Batas waktu model utama belum valid. Gunakan 1 sampai 40 detik pada GEMINI_PRIMARY_TIMEOUT_SECONDS.', 'AI_MODEL_CONFIGURATION');
        }
        // Key and model both isolate the cooldown; cache names never contain the
        // credential. Cache outages must not prevent a provider reply.
        $cooldownKey = 'nusa:gemini:cooldown:'.hash('sha256', $key."\0".$primaryModel);
        if ($hasFallback && $this->primaryCoolingDown($cooldownKey)) {
            $models = [$fallbackModel];
        }
        $thinkingLevel = (string) config('services.gemini.thinking_level', 'low');
        if (! in_array($thinkingLevel, ['low', 'medium', 'high'], true)) {
            throw new ChatServiceException('Tingkat penalaran AI belum valid. Gunakan low, medium, atau high pada GEMINI_THINKING_LEVEL.', 'AI_MODEL_CONFIGURATION');
        }
        $maxOutputTokens = (int) config('services.gemini.max_output_tokens', 4096);
        if ($maxOutputTokens < 1024 || $maxOutputTokens > 65536) {
            throw new ChatServiceException('Batas jawaban AI belum valid. Gunakan 1024 sampai 65536 pada GEMINI_MAX_OUTPUT_TOKENS.', 'AI_MODEL_CONFIGURATION');
        }
        $caBundle = config('services.gemini.ca_bundle');
        if ($caBundle !== null && $caBundle !== ''
            && (! is_string($caBundle) || ! is_file($caBundle) || ! is_readable($caBundle))) {
            // Guzzle throws before connecting for a missing CA file. Return a safe
            // configuration error instead of exposing a server path in a 500.
            throw new ChatServiceException('Sertifikat koneksi AI belum dapat digunakan. Periksa konfigurasi sertifikat server.', 'AI_TLS_ERROR', 503);
        }
        $lastError = null;

        $phpLimit = (int) ini_get('max_execution_time');
        $timerReset = false;
        if ($phpLimit > 0 && $phpLimit < self::PHP_EXECUTION_BUDGET && function_exists('set_time_limit')) {
            // Scoped to this request; do not change the machine's php.ini.
            $timerReset = @set_time_limit(self::PHP_EXECUTION_BUDGET);
        }
        $phpLimit = (int) ini_get('max_execution_time');
        // Some hosts prohibit extending execution time. Leave room for Laravel
        // to return a JSON error (or persist a successful turn) on those hosts.
        $elapsed = $timerReset ? 0 : max(0, microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true)));
        $totalTimeout = $phpLimit > 0 ? min(self::TOTAL_PROVIDER_TIMEOUT, $phpLimit - $elapsed - 10) : self::TOTAL_PROVIDER_TIMEOUT;
        $deadline = hrtime(true) / 1e9 + $totalTimeout;

        foreach ($models as $model) {
            $remaining = $deadline - hrtime(true) / 1e9;
            if ($remaining < 1) {
                throw new ChatServiceException('Layanan AI belum selesai menjawab dalam batas waktu. Coba kirim lagi sebentar.', 'AI_TIMEOUT', 504, true);
            }
            $timeout = min(self::PROVIDER_TIMEOUT, $remaining);
            if ($hasFallback && $model === $primaryModel) {
                $timeout = min($primaryTimeout, $timeout);
            }
            $generation = ['maxOutputTokens' => $maxOutputTokens];
            if (str_starts_with($model, 'gemini-3')) {
                // Gemini 3 models use thinkingLevel rather than old sampling controls.
                $generation['thinkingConfig'] = ['thinkingLevel' => $thinkingLevel, 'includeThoughts' => false];
            }
            if (str_starts_with($model, 'gemini-2.5-flash')) {
                $generation['thinkingConfig'] = ['thinkingBudget' => 0];
            }

            try {
                // The API key is a header, so request URLs and errors never contain it.
                $response = Http::acceptJson()->asJson()
                    ->withHeaders(['x-goog-api-key' => $key])
                    ->withOptions(['verify' => $caBundle ?: true])
                    ->connectTimeout(min(8, $timeout))->timeout($timeout)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                        'contents' => $contents,
                        'systemInstruction' => ['parts' => [['text' => $instruction]]],
                        'generationConfig' => $generation,
                    ]);
            } catch (ConnectionException $exception) {
                $tlsError = (bool) preg_match('/cURL error (35|51|58|59|60|64|66|77|80|82|83|90|91)\b/', $exception->getMessage());
                $timedOut = str_contains($exception->getMessage(), 'cURL error 28');
                $code = $tlsError ? 'AI_TLS_ERROR' : ($timedOut ? 'AI_TIMEOUT' : 'AI_CONNECTION_FAILED');
                Log::warning('Gemini connection failed', ['model' => $model, 'code' => $code]);
                $lastError = new ChatServiceException(
                    $tlsError ? 'Sertifikat koneksi AI belum dapat diverifikasi. Periksa konfigurasi sertifikat server.' : ($timedOut ? 'Layanan AI belum selesai menjawab dalam batas waktu. Coba kirim lagi sebentar.' : 'Server belum dapat menghubungi layanan AI. Periksa koneksi lalu coba lagi.'),
                    $code,
                    $timedOut ? 504 : 503,
                    ! $tlsError,
                );
                if (! $tlsError && $model === $primaryModel && $hasFallback) {
                    if ($timedOut) {
                        $this->coolDownPrimary($cooldownKey);
                    }
                    continue;
                }
                throw $lastError;
            }

            $data = $response->json();
            $data = is_array($data) ? $data : [];
            if ($response->successful()) {
                $candidate = $data['candidates'][0] ?? [];
                $candidate = is_array($candidate) ? $candidate : [];
                $parts = $candidate['content']['parts'] ?? [];
                $parts = is_array($parts) ? array_filter($parts, 'is_array') : [];
                $text = trim(implode("\n", array_map(
                    fn ($part) => is_string($part['text'] ?? null) && empty($part['thought']) ? $part['text'] : '',
                    $parts,
                )));
                if ($text !== '') {
                    if ($model === $primaryModel) {
                        $this->clearPrimaryCooldown($cooldownKey);
                    }
                    return [$text, $model];
                }
                if (isset($data['promptFeedback']['blockReason']) || in_array($candidate['finishReason'] ?? '', ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'], true)) {
                    throw new ChatServiceException('Pertanyaan ini belum dapat diproses layanan AI. Coba ubah kalimatnya.', 'AI_CONTENT_BLOCKED', 422);
                }
                throw new ChatServiceException('Layanan AI mengembalikan jawaban kosong. Coba kirim pertanyaan lagi.', 'AI_EMPTY_RESPONSE', 502, true);
            }

            $status = $response->status();
            Log::warning('Gemini request rejected', ['model' => $model, 'status' => $status]);
            if ($status === 429) {
                throw new ChatServiceException('Batas penggunaan layanan AI sedang tercapai. Tunggu sebentar lalu coba lagi.', 'AI_RATE_LIMITED', 429, true);
            }
            $providerStatus = $data['error']['status'] ?? '';
            $invalidKey = str_contains(strtolower((string) ($data['error']['message'] ?? '')), 'api key');
            if (in_array($status, [401, 403], true) || ($status === 400 && ($invalidKey || $providerStatus === 'UNAUTHENTICATED'))) {
                throw new ChatServiceException('Kunci layanan AI belum dapat digunakan. Periksa konfigurasi server.', 'AI_AUTH_FAILED', 503);
            }
            if ($status === 400 || $status === 422) {
                throw new ChatServiceException('Layanan AI belum dapat memproses pesan ini. Periksa isi pesan atau lampiran lalu coba lagi.', 'AI_REQUEST_REJECTED', 422);
            }
            $lastError = $status === 404
                ? new ChatServiceException('Model AI yang dipilih belum tersedia. Periksa model pada konfigurasi server.', 'AI_MODEL_UNAVAILABLE', 503)
                : new ChatServiceException('Layanan AI sedang mengalami gangguan. Coba kirim lagi sebentar.', 'AI_PROVIDER_ERROR', 502, true);

            // A fallback helps when a model is unavailable, without repeatedly charging or
            // waiting for permanent authentication, validation, or quota failures.
            if ($status !== 404 && $status < 500) {
                throw $lastError;
            }
            if ($model === $primaryModel && $hasFallback && $status === 503) {
                $this->coolDownPrimary($cooldownKey);
            }
        }

        throw $lastError ?? new ChatServiceException('Belum ada model AI yang tersedia di server.', 'AI_MODEL_UNAVAILABLE');
    }

    protected function primaryCoolingDown(string $key): bool
    {
        try {
            return (bool) Cache::get($key, false);
        } catch (\Throwable) {
            return false;
        }
    }

    protected function coolDownPrimary(string $key): void
    {
        try {
            Cache::put($key, true, self::PRIMARY_COOLDOWN_SECONDS);
        } catch (\Throwable) {
            // Failover still works when shared cache storage is unavailable.
        }
    }

    protected function clearPrimaryCooldown(string $key): void
    {
        try {
            Cache::forget($key);
        } catch (\Throwable) {
            // A genuine provider response must not become a cache failure.
        }
    }
}
