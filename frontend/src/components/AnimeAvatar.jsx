import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { Box3, MathUtils, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/.candidate-darkness/AvatarSample_D_Darkness.vrm`
const BONE_NAMES = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand']

export default function AnimeAvatar({ isSpeaking, isThinking, isListening, greeting, reducedMotion, compact, onReady, onFailure }) {
  const [rig, setRig] = useState(null)
  const group = useRef(null)
  const elapsed = useRef(0)
  const blink = useRef({ next: 2.8, start: -10 })
  const wave = useRef({ start: 0 })
  const smoothed = useRef({ speaking: 0, thinking: 0, listening: 0 })
  const motion = useRef({ isSpeaking, isThinking, isListening, reducedMotion })
  const { pointer, invalidate } = useThree()

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let avatar = null
    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))

    async function load() {
      try {
        const response = await fetch(MODEL_URL, { signal: controller.signal })
        if (!response.ok) throw new Error(`Avatar request failed (${response.status})`)
        const gltf = await loader.parseAsync(await response.arrayBuffer(), '')
        const vrm = gltf.userData.vrm
        if (!vrm) {
          VRMUtils.deepDispose(gltf.scene)
          throw new Error('The avatar does not contain a VRM humanoid')
        }
        if (cancelled) {
          VRMUtils.deepDispose(vrm.scene)
          return
        }
        avatar = vrm
        VRMUtils.rotateVRM0(vrm)
        const bones = Object.fromEntries(BONE_NAMES.map(name => [name, vrm.humanoid.getNormalizedBoneNode(name)]))
        bones.leftUpperArm?.rotation.set(0, 0, 1.15)
        bones.rightUpperArm?.rotation.set(0, 0, -1.15)
        vrm.update(0)
        vrm.scene.updateMatrixWorld(true)
        const bounds = new Box3().setFromObject(vrm.scene)
        const scale = (compact ? 5.6 : 3.7) / bounds.getSize(new Vector3()).y
        vrm.scene.scale.multiplyScalar(scale)
        vrm.scene.position.y = (compact ? -3.55 : -1.78) - bounds.min.y * scale
        vrm.scene.name = 'NusaAnimeAvatar'
        vrm.scene.traverse(object => { if (object.isMesh) object.frustumCulled = false })
        setRig({ vrm, bones })
        onReady()
        invalidate()
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') onFailure()
      }
    }
    load()
    return () => {
      cancelled = true
      controller.abort()
      if (avatar) VRMUtils.deepDispose(avatar.scene)
    }
  }, [compact, onReady, onFailure, invalidate])

  useEffect(() => {
    motion.current = { isSpeaking, isThinking, isListening, reducedMotion }
    invalidate()
  }, [isSpeaking, isThinking, isListening, reducedMotion, invalidate])

  useEffect(() => {
    const state = motion.current
    if (rig && !state.reducedMotion && !state.isSpeaking && !state.isThinking && !state.isListening) {
      wave.current.start = elapsed.current
      invalidate()
    }
  }, [rig, greeting, invalidate])

  useFrame((_, rawDelta) => {
    if (!rig || document.hidden) return
    const delta = Math.min(rawDelta, 0.05)
    const state = motion.current
    const animated = !state.reducedMotion
    if (animated) elapsed.current += delta
    const t = animated ? elapsed.current : 0
    const values = smoothed.current
    for (const name of ['speaking', 'thinking', 'listening']) {
      const target = animated && state[`is${name[0].toUpperCase()}${name.slice(1)}`] ? 1 : 0
      values[name] = animated ? MathUtils.damp(values[name], target, 7, delta) : 0
    }
    const { vrm, bones } = rig
    const waveTime = elapsed.current - wave.current.start
    const canWave = animated && !state.isSpeaking && !state.isThinking && !state.isListening
    const waving = canWave && waveTime < 2.8 ? Math.sin(Math.PI * Math.min(1, waveTime / 2.8)) : 0
    const breathing = Math.sin(t * 1.5)
    const speaking = values.speaking
    const thinking = values.thinking
    const listening = values.listening

    bones.spine?.rotation.set(0.012 * breathing, 0, Math.sin(t * 0.6) * 0.012)
    bones.chest?.rotation.set(0.008 * breathing, Math.sin(t * 0.45) * 0.012, 0)
    bones.neck?.rotation.set(0, 0, thinking * 0.035)
    bones.head?.rotation.set(
      -pointer.y * 0.07 + listening * 0.05 + Math.sin(t * 4.2) * speaking * 0.025,
      pointer.x * 0.17 + thinking * Math.sin(t * 0.7) * 0.07,
      thinking * 0.11 + listening * 0.07,
    )
    bones.leftUpperArm?.rotation.set(thinking * 0.2, 0, 1.15 - thinking * 0.5 - speaking * 0.12)
    bones.leftLowerArm?.rotation.set(-0.08, 0, -thinking * 1.7 - speaking * (0.17 + Math.sin(t * 2.2) * 0.1))
    bones.leftHand?.rotation.set(0, 0, thinking * -0.2)
    bones.rightUpperArm?.rotation.set(-waving * 0.15, 0, -1.15 + waving * 1.8)
    bones.rightLowerArm?.rotation.set(0, 0, 0.08 + waving * 1.1)
    bones.rightHand?.rotation.set(waving * Math.sin(t * 8) * 0.3, 0, waving * Math.sin(t * 8) * 0.2)

    if (group.current) {
      group.current.position.y = breathing * 0.012
      group.current.rotation.y = -0.06 + pointer.x * 0.06
    }
    if (animated && t > blink.current.next) {
      blink.current.start = t
      blink.current.next = t + 3 + Math.random() * 3
    }
    const blinkPhase = (t - blink.current.start) / 0.18
    const blinkValue = animated && blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0
    const mouth = speaking * (0.25 + 0.65 * Math.abs(Math.sin(t * 12.5)))
    const expression = (name, value) => {
      if (vrm.expressionManager?.getExpression(name)) vrm.expressionManager.setValue(name, value)
    }
    expression('blink', blinkValue)
    expression('aa', mouth)
    expression('oh', mouth * (0.15 + 0.15 * Math.sin(t * 7)))
    expression('happy', waving * 0.3 + speaking * 0.08)
    expression('relaxed', listening * 0.22 + thinking * 0.07)
    vrm.update(animated ? delta : 0)
  })

  return rig ? <group ref={group}><primitive object={rig.vrm.scene} dispose={null} /></group> : null
}
