<?php
require __DIR__ . '/vendor/autoload.php';
Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();
$key = $_ENV['GEMINI_API_KEY'] ?? '';
if (!$key) { echo json_encode(['configured' => false]); exit; }
$handle = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
curl_setopt_array($handle, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: '.$key],
  CURLOPT_POSTFIELDS => json_encode(['contents' => [['role' => 'user', 'parts' => [['text' => 'Balas hanya dengan: Koneksi Nusa AI berhasil.']]]], 'generationConfig' => ['maxOutputTokens' => 32, 'thinkingConfig' => ['thinkingBudget' => 0]]]),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CAINFO => __DIR__ . '/resources/certificates/cacert.pem',
  CURLOPT_CONNECTTIMEOUT => 8,
  CURLOPT_TIMEOUT => 20,
]);
$body = curl_exec($handle);
$status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
$error = curl_errno($handle);
$data = json_decode($body ?: '{}', true) ?: [];
$message = str_replace($key, '[REDACTED]', $data['error']['message'] ?? '');
$message = preg_replace('/AIza[0-9A-Za-z_-]+/', '[REDACTED]', $message);
echo json_encode(['configured' => true, 'http_status' => $status, 'transport_error' => $error, 'error_status' => $data['error']['status'] ?? null, 'error_message' => $message, 'reply' => $data['candidates'][0]['content']['parts'][0]['text'] ?? null], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);

