import assert from 'node:assert/strict'
import test from 'node:test'
import { getAccountScope, getInitialBackendUrl, isSessionVisible, toServerAttachment } from './chatData.js'

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

test('relative API attachments resolve to storage on the selected service', () => {
  const file = { id: 2, file_path: 'storage/attachments/one/photo.png', file_name: 'photo.png' }
  assert.equal(toServerAttachment(file, '/api', 'https://nusa.example.test').url,
    'https://nusa.example.test/storage/attachments/one/photo.png')
  assert.equal(toServerAttachment(file, 'https://api.example.test/nusa/api').url,
    'https://api.example.test/nusa/storage/attachments/one/photo.png')
  for (const path of ['storage/attachments/../secret', 'https://other.test/photo.png', '//other.test/photo.png', 'storage/attachments/%2e%2e/secret']) {
    assert.equal(toServerAttachment({ ...file, file_path: path }, '/api', 'https://nusa.example.test').url, null)
  }
})
