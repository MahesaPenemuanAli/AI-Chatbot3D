const AI_ERROR_CODES = new Set([
  'AI_NOT_CONFIGURED', 'AI_AUTH_FAILED', 'AI_CONNECTION_FAILED', 'AI_TLS_ERROR',
  'AI_RATE_LIMITED', 'AI_REQUEST_REJECTED', 'AI_MODEL_UNAVAILABLE',
  'AI_MODEL_CONFIGURATION', 'AI_PROVIDER_ERROR', 'AI_CONTENT_BLOCKED', 'AI_EMPTY_RESPONSE', 'AI_TIMEOUT',
])

function retryDelay(response) {
  const value = response.headers?.get?.('Retry-After')
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400 ? seconds : null
}

// Only documented API errors may supply display text. Generic framework,
// gateway, and PHP errors can contain SQL, HTML, server paths, or credentials.
export function createChatResponseError(response, body, setupMessage) {
  const data = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const status = response.status
  const retryAfter = retryDelay(response)
  const knownAI = AI_ERROR_CODES.has(data.code)
  const aiMessage = data.code === 'AI_NOT_CONFIGURED'
    ? setupMessage || 'AI langsung belum diaktifkan oleh pengelola layanan.'
    : knownAI && typeof data.message === 'string' ? data.message.trim() : ''
  let message
  let retryable = data.retryable !== false

  if (status === 401) {
    message = 'Sesi masukmu berakhir. Silakan masuk kembali.'
    retryable = false
  } else if (status === 413) {
    message = 'Berkas melebihi batas unggahan layanan. Kurangi ukuran lampiran lalu coba lagi.'
  } else if (status === 500) {
    message = 'Server berhenti saat memproses pesan. Jawaban belum berhasil diterima. Coba kirim lagi sebentar.'
  } else if (aiMessage) {
    message = aiMessage
  } else if (status === 429) {
    message = retryAfter
      ? `Terlalu banyak pesan dalam waktu singkat. Tunggu ${retryAfter} detik lalu coba lagi.`
      : 'Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar lalu coba lagi.'
  } else if (status === 404) {
    message = 'Percakapan ini belum tersedia di layanan. Segarkan riwayat atau mulai percakapan AI baru.'
    retryable = false
  } else if (status === 419) {
    message = 'Sesi koneksi telah kedaluwarsa. Muat ulang halaman sebelum mengirim pesan lagi.'
    retryable = false
  } else if (status === 422) {
    const errors = data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors) ? data.errors : {}
    const validation = Object.values(errors).flat().filter(value => typeof value === 'string').join(' ')
    message = validation || 'Lampiran atau pesan belum dapat diterima layanan.'
  } else if (status === 502) {
    message = 'Layanan penghubung AI belum menerima jawaban dari server. Coba lagi sebentar.'
  } else if (status === 503) {
    message = 'Layanan AI sedang tidak tersedia. Tunggu sebentar lalu coba lagi.'
  } else if (status === 504) {
    message = 'Waktu menunggu jawaban dari layanan AI telah habis. Coba kirim lagi sebentar.'
  } else {
    message = 'Layanan AI belum dapat menjawab. Periksa koneksi dan pengaturan layanan, lalu coba lagi.'
  }

  const error = new Error(message)
  error.authExpired = status === 401
  error.retryable = retryable
  error.status = status
  error.retryAfter = retryAfter
  return error
}
