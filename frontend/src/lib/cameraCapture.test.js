import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraErrorMessage, captureCameraFrame, createCameraSession } from './cameraCapture.js'
import { validateAttachmentFiles } from './chatData.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function mockStream() {
  const track = { stops: 0, stop() { this.stops += 1 } }
  return { track, getTracks: () => [track] }
}

test('camera requests only video and releases the previous stream when switching cameras', async () => {
  const constraints = [], streams = [], errors = []
  const first = mockStream(), second = mockStream()
  const camera = createCameraSession({
    mediaDevices: { getUserMedia: async value => { constraints.push(value); return constraints.length === 1 ? first : second } },
    onStream: value => streams.push(value), onError: value => errors.push(value),
  })
  assert.equal(await camera.start(), true)
  assert.equal(constraints[0].audio, false)
  assert.equal(constraints[0].video.facingMode.ideal, 'environment')
  assert.equal(await camera.start('user'), true)
  assert.equal(constraints[1].video.facingMode.ideal, 'user')
  assert.equal(first.track.stops, 1)
  camera.stop()
  assert.equal(second.track.stops, 1)
  assert.equal(streams.length, 2)
  assert.deepEqual(errors, [])
})

test('closing during a permission request stops the late stream without showing a preview', async () => {
  const permission = deferred(), late = mockStream()
  let shown = 0, errors = 0
  const camera = createCameraSession({ mediaDevices: { getUserMedia: () => permission.promise }, onStream: () => shown++, onError: () => errors++ })
  const pending = camera.start()
  camera.stop()
  permission.resolve(late)
  assert.equal(await pending, false)
  assert.equal(late.track.stops, 1)
  assert.equal(shown, 0)
  assert.equal(errors, 0)
})

test('a late result from an older camera cannot replace the selected camera', async () => {
  const first = deferred(), second = deferred()
  const oldStream = mockStream(), selected = mockStream(), shown = []
  let requests = 0
  const camera = createCameraSession({ mediaDevices: { getUserMedia: () => (++requests === 1 ? first.promise : second.promise) }, onStream: value => shown.push(value), onError: assert.fail })
  const older = camera.start('environment')
  const newer = camera.start('user')
  second.resolve(selected)
  assert.equal(await newer, true)
  first.resolve(oldStream)
  assert.equal(await older, false)
  assert.equal(oldStream.track.stops, 1)
  assert.deepEqual(shown, [selected])
  assert.equal(selected.track.stops, 0)
  camera.stop()
})

test('denied, missing, and busy cameras give actionable feedback', async () => {
  assert.match(cameraErrorMessage({ name: 'NotAllowedError' }), /Izinkan kamera/)
  assert.match(cameraErrorMessage({ name: 'NotFoundError' }), /tidak ditemukan/)
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /aplikasi lain/)
  const feedback = []
  const camera = createCameraSession({ mediaDevices: { getUserMedia: async () => { throw { name: 'NotAllowedError' } } }, onStream: assert.fail, onError: message => feedback.push(message) })
  assert.equal(await camera.start(), false)
  assert.match(feedback[0], /Izinkan kamera/)
})

test('captured photos fit 1600 pixels and use JPEG accepted by the attachment pipeline', async () => {
  const video = { readyState: 2, videoWidth: 4032, videoHeight: 3024 }
  let draw, encoding
  const canvas = { getContext: () => ({ drawImage: (...args) => { draw = args } }), toBlob(callback, type, quality) { encoding = [type, quality]; callback(new Blob(['jpeg'], { type })) } }
  const file = await captureCameraFrame(video, { createCanvas: () => canvas })
  assert.equal(canvas.width, 1600)
  assert.equal(canvas.height, 1200)
  assert.deepEqual(draw, [video, 0, 0, 1600, 1200])
  assert.deepEqual(encoding, ['image/jpeg', .88])
  assert.match(file.name, /^nusa-kamera-\d+\.jpg$/)
  assert.equal(validateAttachmentFiles([file]), '')
  assert.match(validateAttachmentFiles([file], [{ file }], { max_attachment_count: 1, max_attachment_bytes: 100, max_total_attachment_bytes: 100 }), /Maksimal 1/)
})

test('capture rejects unready video and empty images instead of attaching a blank photo', async () => {
  await assert.rejects(captureCameraFrame({ readyState: 1, videoWidth: 0, videoHeight: 0 }), /pratinjau kamera siap/)
  const canvas = { getContext: () => ({ drawImage() {} }), toBlob: callback => callback(null) }
  await assert.rejects(captureCameraFrame({ readyState: 2, videoWidth: 640, videoHeight: 480 }, { createCanvas: () => canvas }), /belum berhasil diambil/)
})
