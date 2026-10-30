import test from 'node:test'
import assert from 'node:assert/strict'
import { dampValue, inspectionAngle, storyProgress } from './motionMath.js'

test('motion reaches the same scroll position at 30, 60, and 120 Hz', () => {
  const simulate = fps => {
    let position = 0
    for (let frame = 0; frame < fps * 2; frame += 1) position = dampValue(position, 1, 4.5, 1 / fps)
    return position
  }
  assert.ok(Math.abs(simulate(30) - simulate(60)) < 1e-10)
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 1e-10)
})

test('pointer easing does not overshoot or reverse on long frames', () => {
  for (const delta of [0, 1 / 120, 1 / 30, .2, 2]) {
    assert.ok(dampValue(-1, 1, 4, delta) >= -1)
    assert.ok(dampValue(-1, 1, 4, delta) <= 1)
    assert.ok(dampValue(1, -1, 4, delta) <= 1)
    assert.ok(dampValue(1, -1, 4, delta) >= -1)
  }
})

test('inspection always returns to the front and stays within a gentle turn', () => {
  assert.equal(inspectionAngle(0), 0)
  assert.equal(inspectionAngle(2.8), 0)
  assert.equal(inspectionAngle(10), 0)
  for (let frame = 0; frame < 280; frame += 1) assert.ok(Math.abs(inspectionAngle(frame / 100)) < .65)
})

test('inspection begins and ends without a velocity jump', () => {
  const step = .0001
  assert.ok(Math.abs(inspectionAngle(step) / step) < .001)
  assert.ok(Math.abs(inspectionAngle(2.8 - step) / step) < .001)
})

test('cinematic chapters align with their camera poses even at unequal mobile heights', () => {
  const anchors = [0, 860, 1720, 2820]
  assert.equal(storyProgress(0, anchors), 0)
  assert.equal(storyProgress(860, anchors), 1 / 3)
  assert.equal(storyProgress(1720, anchors), 2 / 3)
  assert.equal(storyProgress(2820, anchors), 1)
  assert.equal(storyProgress(2270, anchors), 5 / 6)
  assert.equal(storyProgress(-200, anchors), 0)
  assert.equal(storyProgress(4000, anchors), 1)
})
