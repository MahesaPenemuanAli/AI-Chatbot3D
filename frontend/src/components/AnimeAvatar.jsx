import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { Box3, MathUtils, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getAnimePose, ANIME_BONES } from '../lib/animeMotion'
import { speechEnergy } from '../lib/nusaMotion'

const MODEL_URL = `${import.meta.env.BASE_URL}models/nusa-modern.vrm`

export default function AnimeAvatar({ isSpeaking, isResponding, isThinking, isListening, speechActivity, greeting, reducedMotion, paused, onReady, onFailure }) {
  const [rig, setRig] = useState(null)
  const group = useRef(null)
  const elapsed = useRef(0)
  const blink = useRef({ next: 2.7, start: -10 })
  const waveStart = useRef(-Infinity)
  const smooth = useRef({ speaking: 0, responding: 0, thinking: 0, listening: 0, mouth: 0, gazeX: 0, gazeY: 0 })
  const { pointer, invalidate } = useThree()

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let avatar
    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))
    ;(async () => {
      try {
        const response = await fetch(MODEL_URL, { signal: controller.signal })
        if (!response.ok) throw new Error(`Avatar request failed (${response.status})`)
        const gltf = await loader.parseAsync(await response.arrayBuffer(), '')
        const vrm = gltf.userData.vrm
        if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('Missing humanoid rig') }
        if (disposed) { VRMUtils.deepDispose(vrm.scene); return }
        avatar = vrm
        VRMUtils.rotateVRM0(vrm)
        const bones = Object.fromEntries(ANIME_BONES.map(name => [name, vrm.humanoid.getNormalizedBoneNode(name)]))
        const rest = getAnimePose(0)
        for (const [name, angles] of Object.entries(rest)) bones[name]?.rotation.set(...angles)
        vrm.update(0)
        vrm.scene.updateMatrixWorld(true)
        const bounds = new Box3().setFromObject(vrm.scene)
        const scale = 5.2 / bounds.getSize(new Vector3()).y
        vrm.scene.scale.multiplyScalar(scale)
        vrm.scene.position.y = -2.82 - bounds.min.y * scale
        vrm.scene.name = 'NusaModernAnime'
        vrm.scene.traverse(object => {
          // Animated skin bounds can lag joints and incorrectly cull an arm.
          if (object.isMesh) object.frustumCulled = false
        })
        for (const material of vrm.materials ?? []) {
          if (material.name.includes('Tops_01_CLOTH')) {
            material.color?.set('#aaa1df')
            material.shadeColorFactor?.set('#8f80bc')
          }
          if (material.name === 'Body_00_SKIN' || material.name === 'Face_00_SKIN') material.color?.set('#ffe2d5')
        }
        setRig({ vrm, bones })
        onReady()
        invalidate()
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') onFailure()
      }
    })()
    return () => {
      disposed = true
      controller.abort()
      if (avatar) VRMUtils.deepDispose(avatar.scene)
    }
  }, [onReady, onFailure, invalidate])

  useEffect(() => {
    if (rig && !reducedMotion) waveStart.current = elapsed.current
    invalidate()
  }, [rig, greeting, reducedMotion, invalidate])
  useEffect(() => {
    if (isSpeaking || isResponding || isThinking || isListening) waveStart.current = -Infinity
    invalidate()
  }, [isSpeaking, isResponding, isThinking, isListening, paused, reducedMotion, invalidate])

  useFrame((_, rawDelta) => {
    if (!rig || document.hidden || paused) return
    const delta = Math.min(rawDelta, .05)
    const animated = !reducedMotion
    if (animated) elapsed.current += delta
    const t = animated ? elapsed.current : 0
    const values = smooth.current
    for (const [key, active] of Object.entries({ speaking: isSpeaking, responding: isResponding, thinking: isThinking, listening: isListening })) {
      values[key] = animated ? MathUtils.damp(values[key], active ? 1 : 0, 5, delta) : 0
    }
    values.gazeX = MathUtils.damp(values.gazeX, animated ? pointer.x : 0, 3, delta)
    values.gazeY = MathUtils.damp(values.gazeY, animated ? pointer.y : 0, 3, delta)
    const pose = getAnimePose(t, { ...values, waveElapsed: animated ? t - waveStart.current : Infinity })
    for (const [name, angles] of Object.entries(pose)) {
      const bone = rig.bones[name]
      if (!bone) continue
      for (let axis = 0; axis < 3; axis++) {
        const key = ['x', 'y', 'z'][axis]
        bone.rotation[key] = animated ? MathUtils.damp(bone.rotation[key], angles[axis], 6, delta) : angles[axis]
      }
    }
    if (group.current) {
      group.current.position.set(Math.sin(t * .7) * .035, Math.sin(t * 1.8) * .012, 0)
      group.current.rotation.y = -.035 + values.gazeX * .055
    }
    if (animated && t > blink.current.next) {
      blink.current.start = t
      blink.current.next = t + 2.8 + Math.random() * 3
    }
    const phase = (t - blink.current.start) / .19
    const blinkValue = animated && phase >= 0 && phase <= 1 ? Math.sin(phase * Math.PI) : 0
    // Only audible speech drives the mouth, never a streaming/thinking state.
    const activity = speechActivity?.current ?? speechActivity
    const energy = animated && isSpeaking ? speechEnergy(activity, performance.now()) : 0
    values.mouth = MathUtils.damp(values.mouth, energy, 22, delta)
    const expression = (name, value) => rig.vrm.expressionManager?.setValue(name, value)
    expression('blink', blinkValue)
    expression('aa', values.mouth * .65)
    expression('oh', values.mouth * (.2 + .15 * Math.sin(t * 8)))
    expression('happy', .12 + values.speaking * .08)
    expression('relaxed', values.listening * .18)
    rig.vrm.update(animated ? delta : 0)
  })

  return rig ? <group ref={group}><primitive object={rig.vrm.scene} dispose={null}/></group> : null
}
