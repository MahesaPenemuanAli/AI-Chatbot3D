import assert from 'node:assert/strict'
import test from 'node:test'
import { createChatResponseError } from './chatErrors.js'

const response = (status, retryAfter = null) => ({ status, headers: { get: () => retryAfter } })

test('chat throttle gives an actionable wait message and respects Retry-After', () => {
  const error = createChatResponseError(response(429, '42'), { code: 'RATE_LIMITED', message: 'Server throttle text', retryable: true })
  assert.match(error.message, /Terlalu banyak pesan/)
  assert.match(error.message, /42 detik/)
  assert.equal(error.retryAfter, 42)
  assert.equal(error.retryable, true)
  assert.equal(error.authExpired, false)
})

test('malformed or absent retry headers never appear as raw text', () => {
  for (const header of [null, '0', '-1', 'NaN', '<html>private', '99999999999999']) {
    const error = createChatResponseError(response(429, header), { code: 'RATE_LIMITED' })
    assert.equal(error.retryAfter, null)
    assert.match(error.message, /Tunggu sebentar/)
    assert.doesNotMatch(error.message, /NaN|private|999999/)
  }
})

test('documented provider errors retain safe server guidance and retryability', () => {
  for (const code of ['AI_AUTH_FAILED', 'AI_RATE_LIMITED', 'AI_TLS_ERROR', 'AI_PROVIDER_ERROR', 'AI_MODEL_CONFIGURATION', 'AI_TIMEOUT']) {
    const error = createChatResponseError(response(503), { code, message: 'Panduan penyedia AI.', retryable: false })
    assert.equal(error.message, 'Panduan penyedia AI.')
    assert.equal(error.retryable, false)
  }
  const setup = createChatResponseError(response(503), { code: 'AI_NOT_CONFIGURED', message: 'Ignored server copy' }, 'Aktifkan AI melalui pengelola.')
  assert.equal(setup.message, 'Aktifkan AI melalui pengelola.')
})

test('PHP and framework server errors never expose diagnostics or arbitrary AI-prefixed codes', () => {
  for (const data of [
    { message: 'SQLSTATE password=private C:/server/.env', exception: 'QueryException' },
    '<html>Fatal error: private config</html>',
    { code: 'AI_UNKNOWN', message: 'SQLSTATE private' },
    { code: 'AI_PROVIDER_ERROR', message: 'Fatal error private', retryable: true },
    null,
  ]) {
    const error = createChatResponseError(response(500), data)
    assert.match(error.message, /Server berhenti/)
    assert.doesNotMatch(error.message, /SQLSTATE|password|private|\.env|<html>/)
  }
  assert.doesNotMatch(createChatResponseError(response(503), { code: 'AI_UNKNOWN', message: 'private details' }).message, /private/)
})

test('gateway statuses explain connection failure without echoing proxy HTML', () => {
  for (const [status, expected] of [[502, /penghubung/], [503, /tidak tersedia/], [504, /Waktu menunggu/]]) {
    const error = createChatResponseError(response(status), { message: 'Proxy internal hostname private' })
    assert.match(error.message, expected)
    assert.doesNotMatch(error.message, /private|hostname/)
    assert.equal(error.retryable, true)
    assert.equal(error.status, status)
  }
})

test('session authentication, missing conversation and expired connection have separate actions', () => {
  const auth = createChatResponseError(response(401), { message: 'private details', retryable: true })
  assert.equal(auth.authExpired, true)
  assert.equal(auth.retryable, false)
  assert.match(auth.message, /masuk kembali/)
  const missing = createChatResponseError(response(404), {})
  assert.match(missing.message, /percakapan AI baru/)
  assert.equal(missing.retryable, false)
  const csrf = createChatResponseError(response(419), {})
  assert.match(csrf.message, /Muat ulang/)
  assert.equal(csrf.authExpired, false)
  assert.equal(csrf.retryable, false)
})

test('upload and validation feedback remain specific, including blocked-content provider errors', () => {
  assert.match(createChatResponseError(response(413), {}).message, /ukuran lampiran/)
  assert.equal(createChatResponseError(response(422), { errors: { message: ['Teks terlalu panjang.'], attachments: ['Berkas kosong.'] } }).message, 'Teks terlalu panjang. Berkas kosong.')
  assert.equal(createChatResponseError(response(422), { code: 'AI_CONTENT_BLOCKED', message: 'Coba ubah kalimatnya.', retryable: false }).message, 'Coba ubah kalimatnya.')
  assert.match(createChatResponseError(response(422), { errors: 'malformed' }).message, /belum dapat diterima/)
})
