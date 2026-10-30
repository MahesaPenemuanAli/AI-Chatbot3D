import test from 'node:test'
import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
import { getNusaCameraDistance, NUSA_FRAME } from './nusaFraming.js'

test('the full human silhouette and boots remain inside desktop and landing stages', () => {
  for (const [width, height] of [[130,176], [164,190], [220,208], [270,385], [326,320], [460,550]]) {
    const aspect = width / height
    const camera = new PerspectiveCamera(33, aspect, .1, 100)
    camera.position.set(0, NUSA_FRAME.centerY, getNusaCameraDistance(aspect))
    camera.lookAt(0, NUSA_FRAME.centerY, 0)
    camera.updateMatrixWorld()
    for (const x of [-NUSA_FRAME.width / 2, NUSA_FRAME.width / 2]) {
      for (const y of [-NUSA_FRAME.height / 2, NUSA_FRAME.height / 2]) {
        const projected = new Vector3(x, y + NUSA_FRAME.centerY, NUSA_FRAME.frontZ).project(camera)
        assert.ok(Math.abs(projected.x) <= 1.000001, `hand clipped at ${width}×${height}`)
        assert.ok(Math.abs(projected.y) <= 1.000001, `head or boots clipped at ${width}×${height}`)
      }
    }
  }
})

