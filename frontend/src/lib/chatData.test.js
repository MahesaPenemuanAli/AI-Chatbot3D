import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_UPLOAD_LIMITS, MAX_ATTACHMENT_BYTES, getAccountScope, getInitialBackendUrl, getServiceKey, getUploadLimits, hydrateSession, isSessionVisible, mergeRemoteSessions, normalizeBackendUrl, restoreAccount, restoreSessions, serializeSessions, toServerAttachment, validateAttachmentFiles } from './chatData.js'

test('API defaults migrate old loopback addresses without replacing custom services', () => {
  assert.equal(getInitialBackendUrl(), '/api')
  assert.equal(getInitialBackendUrl('http://localhost:8000/api/'), '/api')
  assert.equal(getInitialBackendUrl('http://127.0.0.1:8000/api'), '/api')
  assert.equal(getInitialBackendUrl(undefined, 'https://api.example.test/api/'), 'https://api.example.test/api')
  assert.equal(getInitialBackendUrl('https://custom.example.test/v1/'), 'https://custom.example.test/v1')
})

test('relative APIs isolate saved conversations by service origin and account', () => {
  const scope = getAccountScope({ id: 7 }, '/api', 'https://nusa.example.test')
  assert.equal(scope, 'https://nusa.example.test/api::7')
  const session = { mode: 'live', accountScope: scope }
  assert.equal(isSessionVisible(session, scope), true)
  assert.equal(isSessionVisible(session, getAccountScope({ id: 8 }, '/api', 'https://nusa.example.test')), false)
  assert.equal(isSessionVisible(session, getAccountScope({ id: 7 }, '/api', 'https://other.example.test')), false)
  assert.equal(getAccountScope({ id: 7 }, 'javascript:alert(1)', 'https://nusa.example.test'), null)
  assert.equal(getAccountScope({ id: 7 }, 'https://key:secret@example.test/api'), null)
})

test('media previews use temporary signed links only on the selected API', () => {
  const signature = 'a'.repeat(64)
  const signed = `/api/chat/attachments/2?expires=2000000000&signature=${signature}`
  const file = { id: 2, file_path: 'attachments/photo.png', file_name: 'photo.png', download_url: signed }
  assert.equal(toServerAttachment(file, '/api', 'https://nusa.example.test').url,
    `https://nusa.example.test${signed}`)
  assert.equal(toServerAttachment({ ...file, download_url: `/nusa${signed}` }, 'https://api.example.test/nusa/api').url,
    `https://api.example.test/nusa${signed}`)
  for (const path of ['storage/attachments/photo.png', `https://other.test${signed}`, `//other.test${signed}`, '/api/chat/attachments/2', `/api/chat/attachments/../secret?expires=2000000000&signature=${signature}`, `/api/chat/attachments/2?expires=2000000000&signature=invalid`]) {
    assert.equal(toServerAttachment({ ...file, download_url: path }, '/api', 'https://nusa.example.test').url, null)
  }
  assert.equal(toServerAttachment({ file_path: 'storage/attachments/one/photo.png' }, '/api', 'https://nusa.example.test').url, null)
})

test('connection edits accept explicit web endpoints and reject ambiguous or insecure addresses', () => {
  const origin = 'https://nusa.example.test'
  assert.equal(normalizeBackendUrl(' /api/ ', origin), '/api')
  assert.equal(normalizeBackendUrl('https://api.example.test/nusa/api/', origin), 'https://api.example.test/nusa/api')
  assert.equal(getServiceKey('/api', origin), getServiceKey('https://nusa.example.test/api/', origin))
  for (const address of ['', '//other.test/api', 'api', 'javascript:alert(1)', '/api?token=secret', '/api#fragment', 'https://name:secret@other.test/api', 'http://api.example.test/api', '/\\other.test/api', '/a pi']) assert.throws(() => normalizeBackendUrl(address, origin))
  assert.equal(getInitialBackendUrl('javascript:alert(1)'), '/api')
  assert.equal(getInitialBackendUrl(undefined, 'javascript:alert(1)'), '/api')
  assert.equal(getInitialBackendUrl(undefined, '//other.test/api'), '/api')
})

test('stored credentials are restored exclusively for their original service', () => {
  const origin = 'https://nusa.example.test'
  const user = { id: 7, name: 'Kawan', email: 'kawan@example.test' }
  const saved = { service: 'https://nusa.example.test/api', token: 'test-token', user }
  assert.deepEqual(restoreAccount(saved, '/api', origin), { token: 'test-token', user })
  assert.equal(restoreAccount(saved, 'https://other.test/api', origin), null)
  assert.equal(restoreAccount({ token: 'legacy-token', user }, '/api', origin), null)
  assert.equal(restoreAccount({ ...saved, user: { ...user, name: {} } }, '/api', origin), null)
})

test('remote history normalizes nullable attachments and discards invalid records without crashing', () => {
  const history = [null, { id: 1, role: 'user', content: 'Bali', attachments: null }, { id: 2, role: 'model', content: 'Contoh rute', attachments: [null, {}] }, { role: 'system', content: 'ignored' }, { role: 'assistant', content: {} }]
  const session = hydrateSession({ id: 'session-1', title: {}, updated_at: '2026-10-27T00:00:00Z' }, history, 'scope', '/api', 'https://nusa.example.test')
  assert.equal(session.title, 'Perjalanan tersimpan')
  assert.equal(session.messages.length, 2)
  assert.deepEqual(session.messages[0].attachments, [])
  assert.equal(session.messages[1].role, 'assistant')
  assert.equal(hydrateSession(null, history, 'scope', '/api'), null)
  assert.equal(hydrateSession({ id: 'session-1' }, {}, 'scope', '/api'), null)
})

test('history refresh preserves in-flight content, updates saved previews and isolates account scopes', () => {
  const local = { id: 'one', accountScope: 'A', updated: 10, messages: [{ content: 'Still revealing…', attachments: [{ id: 'file', name: 'image.png', url: null }] }] }
  const remote = { ...local, updated: 20, messages: [{ content: 'Complete', attachments: [{ id: 'file', name: 'image.png', url: 'https://safe.test/signed' }] }] }
  assert.equal(mergeRemoteSessions([local], [remote], 'one')[0].messages[0].content, 'Still revealing…')
  assert.equal(mergeRemoteSessions([local], [remote], 'one')[0].messages[0].attachments[0].url, 'https://safe.test/signed')
  assert.equal(mergeRemoteSessions([local], [remote])[0].messages[0].content, 'Complete')
  assert.equal(mergeRemoteSessions([local], [{ ...remote, accountScope: 'B' }]).length, 2)
})

test('attachment validation enforces count, empty files, type and combined upload budget', () => {
  const image = size => ({ name: 'photo.png', type: 'image/png', size })
  assert.equal(validateAttachmentFiles([image(1024)]), '')
  assert.match(validateAttachmentFiles([image(0)]), /kosong/)
  assert.match(validateAttachmentFiles([{ ...image(1024), type: 'text/html' }]), /Gunakan/)
  assert.match(validateAttachmentFiles(Array.from({ length: 5 }, () => image(1))), /Maksimal 4/)
  assert.match(validateAttachmentFiles([image(MAX_ATTACHMENT_BYTES + 1)]), /setiap lampiran/)
  assert.match(validateAttachmentFiles([image(MAX_ATTACHMENT_BYTES)], [{ file: image(1) }]), /Total ukuran/)
})

test('stored history drops temporary media links and marks interrupted uploads', () => {
  const sessions = [{ messages: [{ uploadState: 'sending', attachments: [{ id: 'one', name: 'photo.png', previewUrl: 'blob:temporary', url: 'https://safe.test/signed', file: {} }] }] }]
  const saved = serializeSessions(sessions)
  assert.equal(saved[0].messages[0].uploadState, 'interrupted')
  assert.deepEqual(saved[0].messages[0].attachments[0], { id: 'one', name: 'photo.png', type: undefined, size: undefined, url: null })
})

test('effective server upload limits override generous UI defaults before files are sent', () => {
  const limits = { max_attachment_bytes: 2 * 1024 * 1024, max_total_attachment_bytes: 8 * 1024 * 1024 - 256 * 1024, max_attachment_count: 4 }
  assert.deepEqual(getUploadLimits(limits), limits)
  assert.deepEqual(getUploadLimits({ max_attachment_bytes: Infinity, max_total_attachment_bytes: -1, max_attachment_count: -1 }), DEFAULT_UPLOAD_LIMITS)
  assert.deepEqual(getUploadLimits({ max_attachment_bytes: MAX_ATTACHMENT_BYTES * 2 }), DEFAULT_UPLOAD_LIMITS)
  assert.match(validateAttachmentFiles([{ type: 'image/png', size: 3 * 1024 * 1024 }], [], limits), /maksimal 2\.0 MB/)
  const disabled = { max_attachment_bytes: 0, max_total_attachment_bytes: 0, max_attachment_count: 0 }
  assert.deepEqual(getUploadLimits(disabled), disabled)
  assert.match(validateAttachmentFiles([{ type: 'image/png', size: 1024 }], [], disabled), /Maksimal 0/)
  assert.equal(validateAttachmentFiles([], [], disabled), '')
  assert.match(validateAttachmentFiles([{ type: 'image/avif', size: 1024 }]), /Ubah GIF atau AVIF/)
  assert.match(validateAttachmentFiles([{ type: 'image/gif', size: 1024 }]), /Ubah GIF atau AVIF/)
})

test('malformed saved history cannot inject media URLs or crash file rendering', () => {
  const restored = restoreSessions([null, { id: 1 }, { id: 'demo', title: 'Trip', mode: 'demo', messages: [null, { role: 'user', content: 'Bali', uploadState: 'sending', attachments: [{ name: 'photo.png', type: {}, size: -1, url: 'https://other.test/tracker' }] }] }])
  assert.equal(restored.length, 1)
  assert.equal(restored[0].accountScope, null)
  assert.equal(restored[0].messages[0].uploadState, 'interrupted')
  assert.deepEqual(restored[0].messages[0].attachments[0], { id: 'photo.png', name: 'photo.png', type: '', size: 0, url: null })
  assert.deepEqual(restoreSessions({}), [])
})

test('local history budget retains the most recently used conversations', () => {
  const sessions = Array.from({ length: 41 }, (_, index) => ({ id: String(index), updated: index, messages: [] }))
  const saved = serializeSessions(sessions)
  assert.equal(saved.length, 40)
  assert.equal(saved[0].id, '40')
  assert.equal(saved.some(session => session.id === '0'), false)
})
