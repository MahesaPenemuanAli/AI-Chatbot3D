import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Group, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { ANIME_BONES, getAnimePose } from './animeMotion.js'
import { getNusaCameraDistance, getNusaFrame } from './nusaFraming.js'

// Keep the real skin, skeleton and constraints; remove textures for headless QA.
const source = readFileSync(new URL('../../public/models/nusa-modern.vrm', import.meta.url))
const jsonLength = source.readUInt32LE(12)
const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
function stripTextures(value) {
  if (!value || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    if (/texture/i.test(key)) delete value[key]
    else stripTextures(value[key])
  }
}
stripTextures(json.materials)
delete json.extensions.VRMC_vrm.meta.thumbnailImage
delete json.images
delete json.textures
const encoded = Buffer.from(JSON.stringify(json))
const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32)
encoded.copy(padded)
const binary = source.subarray(20 + jsonLength)
const buffer = Buffer.alloc(20 + padded.length + binary.length)
source.copy(buffer, 0, 0, 12)
buffer.writeUInt32LE(buffer.length, 8)
buffer.writeUInt32LE(padded.length, 12)
buffer.writeUInt32LE(0x4e4f534a, 16)
padded.copy(buffer, 20)
binary.copy(buffer, 20 + padded.length)
const loader = new GLTFLoader()
loader.register(parser => new VRMLoaderPlugin(parser))
const gltf = await loader.parseAsync(buffer.buffer, '')
const vrm = gltf.userData.vrm
const bones = Object.fromEntries(ANIME_BONES.map(name => [name, vrm.humanoid.getNormalizedBoneNode(name)]))
const root = new Group()
root.add(vrm.scene)
function apply(pose, smoothing = 1) {
  for (const [name, angles] of Object.entries(pose)) {
    const bone = bones[name]
    if (bone) ['x', 'y', 'z'].forEach((axis, i) => { bone.rotation[axis] = MathUtils.lerp(bone.rotation[axis], angles[i], smoothing) })
  }
  vrm.update(0)
  root.updateMatrixWorld(true)
}
apply(getAnimePose(0))
const bounds = new Box3().setFromObject(vrm.scene)
const scale = 5.2 / bounds.getSize(new Vector3()).y
vrm.scene.scale.multiplyScalar(scale)
vrm.scene.position.y = -2.82 - bounds.min.y * scale
root.rotation.y = -.09

test('every anime joint stays finite when greeting is canceled or state changes', () => {
  for (const elapsed of [undefined, NaN, Infinity, -Infinity, -1, 0, .2, 1.6, 3.2, 999]) {
    for (const t of [NaN, Infinity, 0, 10]) {
      const pose = getAnimePose(t, { waveElapsed: elapsed, speaking: 1, thinking: 1, gazeX: NaN })
      for (const [name, angles] of Object.entries(pose)) assert.ok(angles.every(Number.isFinite), `${name}: ${elapsed}`)
    }
  }
})

test('the actual anime model keeps head, knees and both hands in the mobile frame', () => {
  const points = ['head', 'leftLowerLeg', 'rightLowerLeg', 'leftHand', 'rightHand', 'leftMiddleDistal', 'rightMiddleDistal']
  for (const [width, height] of [[320,330], [390,470], [430,570], [768,650], [420,300]]) {
    const aspect = width / height, frame = getNusaFrame('conversation')
    const camera = new PerspectiveCamera(33, aspect, .1, 100)
    camera.position.set(0, frame.centerY, getNusaCameraDistance(aspect, 33, 'conversation'))
    camera.lookAt(0, frame.centerY, 0)
    camera.updateMatrixWorld()
    for (let t = 0; t < 31; t += .08) {
      apply(getAnimePose(t, { waveElapsed: t < 3.2 ? t : Infinity, speaking: t > 4 && t < 11 ? 1 : 0, thinking: t > 11 && t < 18 ? 1 : 0, listening: t > 18 ? 1 : 0, gazeX: Math.sin(t), gazeY: Math.cos(t) }))
      for (const name of points) {
        const node = bones[name]
        assert.ok(node, `missing ${name}`)
        const point = node.getWorldPosition(new Vector3()).project(camera)
        assert.ok(Number.isFinite(point.x) && Math.abs(point.x) < .98 && Math.abs(point.y) < .98, `${name} clipped at ${width}×${height}, t=${t.toFixed(2)}, ${point.toArray()}`)
      }
    }
  }
})

test('anime arm transitions remain finite and continuous at 30/60/120 fps', () => {
  for (const fps of [30, 60, 120]) {
    apply(getAnimePose(0))
    let last
    for (let frame = 0; frame < fps * 12; frame++) {
      const t = frame / fps
      apply(getAnimePose(t, { waveElapsed: t < 1.4 ? t : Infinity, speaking: t > 2 && t < 6 ? 1 : 0, listening: t > 6 ? 1 : 0 }), 1 - Math.exp(-6 / fps))
      const current = bones.rightHand.getWorldPosition(new Vector3())
      assert.ok(current.toArray().every(Number.isFinite))
      if (last) assert.ok(current.distanceTo(last) < .45, `hand jumped at ${fps} fps`)
      last = current
    }
  }
})
