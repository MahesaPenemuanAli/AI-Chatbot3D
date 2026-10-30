import test from 'node:test'
import assert from 'node:assert/strict'
import { gestureEnvelope, nusaWavePose, speechEnergy } from './nusaMotion.js'
import { MathUtils } from 'three'

test('mouth closes whenever speech stops, including retained boundary data', () => {
  assert.equal(speechEnergy(null, 1000), 0)
  assert.equal(speechEnergy({ active: false, startedAt: 0, boundaryAt: 990, boundarySupported: true }, 1000), 0)
})

test('word boundaries animate a mouth pulse and close it during a pause', () => {
  const activity = { active: true, startedAt: 1000, boundaryAt: 1200, boundarySupported: true }
  assert.ok(speechEnergy(activity, 1200) > .5)
  assert.equal(speechEnergy(activity, 1450), 0)
  assert.equal(speechEnergy(activity, 3000), 0)
})

test('speech approximation remains bounded without browser boundary events', () => {
  const activity = { active: true, startedAt: 1000, boundarySupported: false }
  for (let time = 1000; time < 10000; time += 17) {
    const energy = speechEnergy(activity, time)
    assert.ok(Number.isFinite(energy) && energy >= 0 && energy <= 1)
  }
})

test('gestures settle at rest and ease in and out without a velocity jump', () => {
  assert.equal(gestureEnvelope(-1, 2), 0)
  assert.equal(gestureEnvelope(0, 2), 0)
  assert.equal(gestureEnvelope(1, 2), 1)
  assert.equal(gestureEnvelope(2, 2), 0)
  assert.equal(gestureEnvelope(3, 2), 0)
  assert.ok(gestureEnvelope(.0001, 2) / .0001 < .001)
  assert.ok(gestureEnvelope(1.9999, 2) / .0001 < .001)
})

test('canceling a wave during thinking, listening, or speech never hides the right arm', () => {
  let shoulder = .17
  let wrist = 0
  let time = 0
  let start = 0
  for (const busy of [false, true, false, true, false, true, false]) {
    if (busy) start = -Infinity
    for (let frame = 0; frame < 150; frame++) {
      time += 1 / 60
      const pose = nusaWavePose(time - start, !busy)
      shoulder = MathUtils.damp(shoulder, .17 + pose.lift, 14, 1 / 60)
      wrist = MathUtils.damp(wrist, pose.wrist, 16, 1 / 60)
      assert.ok(Number.isFinite(shoulder), 'shoulder rotation became NaN after a state transition')
      assert.ok(Number.isFinite(wrist), 'wrist rotation became NaN after a state transition')
    }
  }
  // A later explicit greeting must still move the arm, then settle again.
  assert.ok(nusaWavePose(.95).lift > 1)
  assert.deepEqual(nusaWavePose(2), { envelope: 0, lift: 0, wrist: 0 })
})

test('inactive and invalid animation clocks always produce a finite rest pose', () => {
  for (const elapsed of [Infinity, -Infinity, NaN, -1, 0, 2, 100]) {
    assert.deepEqual(nusaWavePose(elapsed), { envelope: 0, lift: 0, wrist: 0 })
  }
  assert.deepEqual(nusaWavePose(.95, false), { envelope: 0, lift: 0, wrist: 0 })
  assert.equal(gestureEnvelope(NaN, 2), 0)
})
