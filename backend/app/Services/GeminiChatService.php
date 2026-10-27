<?php

namespace App\Services;

use App\Exceptions\ChatServiceException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiChatService
{
    public function configured(): bool
    {
        return trim((string) config('services.gemini.key')) !== '';
    }

    public function model(): string
    {
        return (string) config('services.gemini.model', 'gemini-2.5-flash');
    }

    public function generate(array $contents, string $instruction): array
    {
        $key = trim((string) config('services.gemini.key'));
        if ($key === '') {
            throw new ChatServiceException('Layanan AI belum dikonfigurasi di server. Tambahkan GEMINI_API_KEY melalui pengaturan lingkungan.', 'AI_NOT_CONFIGURED');
        }

        $models = array_unique(array_filter([
            $this->model(),
            config('services.gemini.fallback_model', 'gemini-2.5-flash-lite'),
        ], fn ($model) => is_string($model) && preg_match('/^[a-zA-Z0-9._-]+$/', $model)));
        $caBundle = config('services.gemini.ca_bundle');
        if ($caBundle !== null && $caBundle !== ''
            && (! is_string($caBundle) || ! is_file($caBundle) || ! is_readable($caBundle))) {
            // Guzzle throws before connecting for a missing CA file. Return a safe
            // configuration error instead of exposing a server path in a 500.
            throw new ChatServiceException('Sertifikat koneksi AI belum dapat digunakan. Periksa konfigurasi sertifikat server.', 'AI_TLS_ERROR', 503);
        }
        $lastError = null;

        foreach ($models as $model) {
            $generation = ['temperature' => 0.7, 'maxOutputTokens' => 2048];
            if (str_starts_with($model, 'gemini-2.5-flash')) {
                $generation['thinkingConfig'] = ['thinkingBudget' => 0];
            }

            try {
                // The API key is a header, so request URLs and errors never contain it.
                $response = Http::acceptJson()->asJson()
                    ->withHeaders(['x-goog-api-key' => $key])
                    ->withOptions(['verify' => $caBundle ?: true])
                    ->connectTimeout(8)->timeout(25)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                        'contents' => $contents,
                        'systemInstruction' => ['parts' => [['text' => $instruction]]],
                        'generationConfig' => $generation,
                    ]);
            } catch (ConnectionException $exception) {
                $tlsError = str_contains($exception->getMessage(), 'cURL error 60');
                Log::warning('Gemini connection failed', ['model' => $model, 'code' => $tlsError ? 'AI_TLS_ERROR' : 'AI_CONNECTION_FAILED']);
                throw new ChatServiceException(
                    $tlsError ? 'Sertifikat koneksi AI belum dapat diverifikasi. Periksa konfigurasi sertifikat server.' : 'Server belum dapat menghubungi layanan AI. Periksa koneksi lalu coba lagi.',
                    $tlsError ? 'AI_TLS_ERROR' : 'AI_CONNECTION_FAILED',
                    503,
                    ! $tlsError,
                );
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
        }

        throw $lastError ?? new ChatServiceException('Belum ada model AI yang tersedia di server.', 'AI_MODEL_UNAVAILABLE');
    }
}
