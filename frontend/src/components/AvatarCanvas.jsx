import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AnimationMixer, Box3, Euler, Float32BufferAttribute, LoopOnce, LoopRepeat,
  MathUtils, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import AnimeAvatar from './AnimeAvatar'

const MODEL_URL = `${import.meta.env.BASE_URL}models/nusa-robot.glb`
const wrapperStyle = { position: 'relative', width: '100%', height: '100%', minHeight: 0 }

function supportsWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

function disposeModel(scene) {
  const geometries = new Set()
  const materials = new Set()
  scene.traverse((object) => {
    if (!object.isMesh) return
    geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}

// The source character has expressions but no blink or speaking mouth.
// Add these independently so speech does not distort the whole head.
function addFaceDetails(scene) {
  const eyes = scene.getObjectByName('Head_4')
  if (!eyes?.isMesh) return { eyes: null, mouth: null }
  const geometry = eyes.geometry
  const positions = geometry.attributes.position
  const blink = new Float32Array(positions.count * 3)
  for (let index = 0; index < positions.count; index += 1) {
    const z = positions.getZ(index)
    if (z < 0.0036 && z > -0.0051) blink[index * 3 + 2] = (-0.0005877 - z) * 0.96
  }
  const blinkAttribute = new Float32BufferAttribute(blink, 3)
  blinkAttribute.name = 'NusaBlink'
  geometry.morphAttributes.position.push(blinkAttribute)
  if (geometry.morphAttributes.normal) {
    const normalAttribute = new Float32BufferAttribute(new Float32Array(positions.count * 3), 3)
    normalAttribute.name = 'NusaBlink'
    geometry.morphAttributes.normal.push(normalAttribute)
  }
  eyes.updateMorphTargets()
  const mouth = new Mesh(new SphereGeometry(1, 20, 12), new MeshBasicMaterial({ color: '#183b2c' }))
  mouth.name = 'NusaSpeakingMouth'
  mouth.position.set(0, -0.0128, -0.0057)
  mouth.scale.set(0.0025, 0.00045, 0.00036)
  eyes.parent.add(mouth)
  return { eyes, mouth }
}

function Robot({ isSpeaking, isThinking, isListening, greeting, reducedMotion, onReady, onFailure }) {
  const [rig, setRig] = useState(null)
  const group = useRef(null)
  const activeAction = useRef(null)
  const mode = useRef('idle')
  const motion = useRef({ reducedMotion, isSpeaking, isThinking, isListening })
  const smoothed = useRef({ speaking: 0, thinking: 0, listening: 0 })
  const timing = useRef({ elapsed: 0, nextBlink: 2.4, blinkStart: -10, nextGesture: 2 })
  const gestureIndex = useRef(0)
  const offsetQuaternion = useRef(new Quaternion())
  const offsetEuler = useRef(new Euler())
  const { pointer, invalidate } = useThree()

  useEffect(() => {
    let cancelled = false
    let loaded = null
    const loader = new GLTFLoader()
    loader.load(MODEL_URL, (gltf) => {
      if (cancelled) {
        disposeModel(gltf.scene)
        return
      }
      const scene = gltf.scene
      const materials = new Map()
      const faces = []
      scene.traverse((object) => {
        if (!object.isMesh) return
        object.frustumCulled = false
        if (object.morphTargetDictionary) faces.push(object)
        const recolor = (original) => {
          if (materials.has(original)) return materials.get(original)
          const material = original.clone()
          if (material.name === 'Main') material.color.set('#c8e889')
          if (material.name === 'Grey') material.color.set('#e6ecdf')
          if (material.name === 'Black') material.color.set('#173b2c')
          material.roughness = 0.43
          material.metalness = 0.06
          materials.set(original, material)
          return material
        }
        object.material = Array.isArray(object.material)
          ? object.material.map(recolor)
          : recolor(object.material)
      })
      materials.forEach((_, original) => original.dispose())
      const faceDetails = addFaceDetails(scene)
      const restPose = []
      scene.traverse((object) => {
        if (object.isBone) restPose.push({
          bone: object,
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
        })
      })
      const mixer = new AnimationMixer(scene)
      const actions = Object.fromEntries(gltf.animations.map((sourceClip) => {
        const clip = sourceClip.clone()
        clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.morphTargetInfluences'))
        return [clip.name, mixer.clipAction(clip)]
      }))
      actions.Idle?.play()
      mixer.update(0)
      const bounds = new Box3().setFromObject(scene)
      const size = bounds.getSize(new Vector3())
      const scale = 3.68 / size.y
      scene.scale.multiplyScalar(scale)
      scene.position.y -= bounds.min.y * scale
      scene.position.y -= 1.77
      const bones = ['Head', 'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR']
        .map((name) => scene.getObjectByName(name))
        .filter(Boolean)
        .map((bone) => ({ bone, base: bone.quaternion.clone() }))
      loaded = { scene, mixer, actions, bones, restPose, faces, ...faceDetails }
      activeAction.current = actions.Idle
      setRig(loaded)
      onReady()
      invalidate()
    }, undefined, () => {
      if (!cancelled) onFailure()
    })
    return () => {
      cancelled = true
      if (loaded) {
        loaded.mixer.stopAllAction()
        loaded.mixer.uncacheRoot(loaded.scene)
        disposeModel(loaded.scene)
      }
    }
  }, [invalidate, onFailure, onReady])

  const playAction = useCallback((name, once = false) => {
    if (!rig?.actions[name]) return
    const next = rig.actions[name]
    const previous = activeAction.current
    if (previous === next && next.isRunning()) return
    previous?.fadeOut(0.3)
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(name === 'Idle' ? 0.8 : 0.86)
    next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once
    next.fadeIn(0.3).play()
    activeAction.current = next
  }, [rig])

  // A mode change can interrupt a greeting immediately. Reduced motion settles
  // the authored Idle pose, including bones which Idle itself does not animate.
  useEffect(() => {
    motion.current = { reducedMotion, isSpeaking, isThinking, isListening }
    if (!rig) return
    const nextMode = isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : 'idle'
    if (reducedMotion) {
      rig.mixer.stopAllAction()
      rig.restPose.forEach(({ bone, position, quaternion, scale }) => {
        bone.position.copy(position)
        bone.quaternion.copy(quaternion)
        bone.scale.copy(scale)
      })
      const idle = rig.actions.Idle
      idle.reset().stopFading().stopWarping().setLoop(LoopRepeat, Infinity)
        .setEffectiveWeight(1).setEffectiveTimeScale(0.8).play()
      rig.mixer.setTime(0)
      rig.bones.forEach(({ bone, base }) => base.copy(bone.quaternion))
      rig.faces.forEach((face) => face.morphTargetInfluences.fill(0))
      if (rig.mouth) rig.mouth.scale.set(0.0025, 0.00045, 0.00036)
      if (group.current) {
        group.current.rotation.set(0, -0.12, 0)
        group.current.position.y = 0
      }
      smoothed.current = { speaking: 0, thinking: 0, listening: 0 }
      activeAction.current = idle
      mode.current = nextMode
    } else if (mode.current !== nextMode) {
      mode.current = nextMode
      playAction('Idle')
      timing.current.nextGesture = timing.current.elapsed + 0.25
    }
    invalidate()
  }, [rig, reducedMotion, isSpeaking, isThinking, isListening, playAction, invalidate])

  // Register once for this rig. A finished wave must never replace an action
  // which has already taken over, such as a gesture during a spoken answer.
  useEffect(() => {
    if (!rig) return
    const finish = (event) => {
      const state = motion.current
      if (event.action !== rig.actions.Wave || activeAction.current !== event.action) return
      if (state.reducedMotion || state.isSpeaking || state.isThinking || state.isListening) return
      playAction('Idle')
    }
    rig.mixer.addEventListener('finished', finish)
    return () => rig.mixer.removeEventListener('finished', finish)
  }, [rig, playAction])

  // Mount and an explicit greeting change are the only greeting triggers.
  // A greeting requested during a reply is skipped, rather than queued.
  useEffect(() => {
    const state = motion.current
    if (!rig || state.reducedMotion || state.isSpeaking || state.isThinking || state.isListening) return
    playAction('Wave', true)
    invalidate()
  }, [rig, greeting, playAction, invalidate])

  useFrame((_, rawDelta) => {
    if (!rig || document.hidden) return
    const delta = Math.min(rawDelta, 0.05)
    const values = smoothed.current
    const time = timing.current
    time.elapsed += delta
    const t = time.elapsed
    if (reducedMotion) return

    // Reset additive offsets before advancing animation, preventing pose drift.
    rig.bones.forEach(({ bone, base }) => bone.quaternion.copy(base))
    rig.mixer.update(delta)
    rig.bones.forEach(({ bone, base }) => base.copy(bone.quaternion))
    values.speaking = MathUtils.damp(values.speaking, isSpeaking ? 1 : 0, 10, delta)
    values.thinking = MathUtils.damp(values.thinking, isThinking ? 1 : 0, 5, delta)
    values.listening = MathUtils.damp(values.listening, isListening ? 1 : 0, 5, delta)

    if (isSpeaking && t > time.nextGesture) {
      const gestures = ['Yes', 'ThumbsUp', 'Idle']
      playAction(gestures[gestureIndex.current % gestures.length])
      gestureIndex.current += 1
      time.nextGesture = t + 3.8 + Math.random() * 1.4
    }
    if (group.current) {
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, -0.13 + pointer.x * 0.13 + Math.sin(t * 0.42) * 0.025, 3, delta)
      group.current.rotation.z = MathUtils.damp(group.current.rotation.z, Math.sin(t * 0.65) * 0.012 + values.thinking * 0.035, 4, delta)
      group.current.position.y = Math.sin(t * 1.35) * 0.025
    }

    rig.bones.forEach(({ bone }) => {
      let x = 0
      let y = 0
      let z = 0
      if (bone.name === 'Head') {
        x = -pointer.y * 0.055 + values.speaking * Math.sin(t * 3.8) * 0.045 + values.listening * 0.045
        y = pointer.x * 0.12 + values.thinking * Math.sin(t * 0.9) * 0.08
        z = values.thinking * 0.12 + values.listening * 0.05
      }
      if (bone.name === 'UpperArmL') z = values.speaking * (0.1 + Math.sin(t * 2.1) * 0.045)
      if (bone.name === 'LowerArmL') x = values.speaking * Math.sin(t * 2.6) * 0.12
      if (bone.name === 'UpperArmR') z = -values.thinking * 0.2
      if (bone.name === 'LowerArmR') x = values.thinking * 0.35
      offsetEuler.current.set(x, y, z)
      offsetQuaternion.current.setFromEuler(offsetEuler.current)
      bone.quaternion.multiply(offsetQuaternion.current)
    })

    if (t > time.nextBlink) {
      time.blinkStart = t
      time.nextBlink = t + 3.2 + Math.random() * 3.6
    }
    const blinkPhase = (t - time.blinkStart) / 0.16
    const blink = blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0
    if (rig.eyes) rig.eyes.morphTargetInfluences[rig.eyes.morphTargetDictionary.NusaBlink] = blink
    rig.faces.forEach((face) => {
      const surprise = face.morphTargetDictionary.Surprised
      const angry = face.morphTargetDictionary.Angry
      const sad = face.morphTargetDictionary.Sad
      if (surprise !== undefined) face.morphTargetInfluences[surprise] = values.listening * 0.2 + values.thinking * 0.06
      if (angry !== undefined) face.morphTargetInfluences[angry] = 0
      if (sad !== undefined) face.morphTargetInfluences[sad] = 0
    })
    if (rig.mouth) {
      const syllable = 0.5 + Math.sin(t * 18) * 0.32 + Math.sin(t * 29) * 0.18
      rig.mouth.scale.z = 0.00036 + values.speaking * Math.max(0, syllable) * 0.0013
      rig.mouth.scale.x = 0.0025 - values.speaking * syllable * 0.00055
    }
  })

  return rig ? <group ref={group}><primitive object={rig.scene} /></group> : null
}

function WebGLContextGuard({ onFailure }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    let active = true
    let pending
    const onLost = (event) => {
      event.preventDefault()
      // Normal Canvas disposal also loses its context. Wait until React has
      // cleaned up, then show a fallback only for a still-mounted canvas.
      window.clearTimeout(pending)
      pending = window.setTimeout(() => {
        if (active && canvas.isConnected) onFailure()
      }, 250)
    }
    const onRestored = () => window.clearTimeout(pending)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      active = false
      window.clearTimeout(pending)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, onFailure])
  return null
}

function SoftStage({ compact }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.79, 0]} scale={[1, 0.68, 1]}>
        <circleGeometry args={[compact ? 1.06 : 1.25, 64]} />
        <meshBasicMaterial color="#6c9268" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.785, 0]} scale={[1, 0.68, 1]}>
        <circleGeometry args={[0.74, 64]} />
        <meshBasicMaterial color="#49653c" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  )
}

function FriendlyFallback({ loading = false, isSpeaking = false, variant = 'anime' }) {
  if (variant !== 'robot') return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 24 }}>
      <img src={`${import.meta.env.BASE_URL}models/.candidate-darkness/preview.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 35%' }} />
      {loading && <span style={{ position: 'absolute', bottom: '5%', fontSize: 11, color: '#57705b', background: '#ffffffdd', borderRadius: 30, padding: '7px 13px' }}>Menyiapkan Nusa…</span>}
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <svg viewBox="0 0 260 300" width="75%" height="85%" aria-hidden="true">
        <ellipse cx="130" cy="274" rx="67" ry="10" fill="#183b2c" opacity=".08" />
        <rect x="79" y="161" width="102" height="89" rx="37" fill="#badc83" />
        <rect x="65" y="53" width="130" height="120" rx="46" fill="#c8e889" />
        <rect x="77" y="72" width="106" height="72" rx="29" fill="#edf3df" />
        <ellipse cx="106" cy="106" rx="8" ry="12" fill="#183b2c" />
        <ellipse cx="153" cy="106" rx="8" ry="12" fill="#183b2c" />
        <path d="M119 129Q130 137 141 129" fill="none" stroke="#183b2c" strokeWidth={isSpeaking ? 6 : 3} strokeLinecap="round" />
        <rect x="50" y="174" width="28" height="66" rx="14" fill="#c8e889" transform="rotate(14 64 205)" />
        <rect x="182" y="155" width="28" height="66" rx="14" fill="#c8e889" transform="rotate(-28 196 188)" />
        <rect x="89" y="236" width="32" height="31" rx="13" fill="#dfe7d6" />
        <rect x="139" y="236" width="32" height="31" rx="13" fill="#dfe7d6" />
        <circle cx="130" cy="192" r="10" fill="#edf3df" />
        <path d="M130 53V36" stroke="#98b16b" strokeWidth="6" strokeLinecap="round" />
        <circle cx="130" cy="30" r="8" fill="#d5f66c" />
      </svg>
      {loading && <span style={{ position: 'absolute', bottom: '5%', fontSize: 11, color: '#57705b', background: '#ffffffbb', borderRadius: 30, padding: '7px 13px' }}>Menyiapkan Nusa…</span>}
    </div>
  )
}

class AvatarErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function AvatarCanvas({
  isSpeaking = false,
  isThinking = false,
  isListening = false,
  greeting = 0,
  className = '',
  compact = false,
  reducedMotion: requestedReducedMotion,
  variant = 'anime',
}) {
  const root = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(() => !supportsWebGL())
  const [visible, setVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const reducedMotion = requestedReducedMotion ?? prefersReducedMotion
  const onReady = useRef(() => setReady(true)).current
  const onFailure = useRef(() => setFailed(true)).current

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onPreference = (event) => setPrefersReducedMotion(event.matches)
    preference.addEventListener('change', onPreference)
    let inViewport = true
    const onVisibility = () => setVisible(inViewport && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting
      onVisibility()
    }, { rootMargin: '120px' })
    if (root.current) observer.observe(root.current)
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => {
      preference.removeEventListener('change', onPreference)
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
    }
  }, [])

  const status = isSpeaking ? 'sedang berbicara' : isThinking ? 'sedang berpikir' : isListening ? 'sedang mendengarkan' : 'siap menemani'
  const fallback = <FriendlyFallback isSpeaking={isSpeaking} variant={variant} />
  return (
    <div ref={root} className={`nusa-avatar ${className}`} style={wrapperStyle} role="img" aria-label={`Avatar 3D Nusa, ${status}`} data-avatar-state={isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : 'idle'}>
      {failed ? fallback : <AvatarErrorBoundary fallback={fallback}>
        {!ready && <FriendlyFallback loading variant={variant} />}
        <Canvas
          camera={{ position: [0, 0.2, compact ? 7.2 : 7.4], fov: 33 }}
          dpr={[1, 1.65]}
          frameloop={!visible || reducedMotion ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease', position: 'relative' }}
          // Canvas mounts its fallback as canvas children even when WebGL works.
          // Keep it free of effects; rendering failures are handled by the boundary.
          fallback={fallback}
          onCreated={({ gl, camera }) => {
            camera.lookAt(0, 0.06, 0)
            gl.setClearColor('#000000', 0)
          }}
        >
          <ambientLight intensity={variant === 'robot' ? 1.85 : 0.5} />
          <hemisphereLight args={['#fffaf0', '#8a9f76', variant === 'robot' ? 1.5 : 0.55]} />
          <directionalLight position={[-3, 5, 6]} intensity={variant === 'robot' ? 3.2 : 1.35} color="#fffaf1" />
          <directionalLight position={[4, 2, -3]} intensity={variant === 'robot' ? 2.8 : 0.8} color="#e9f9c6" />
          <WebGLContextGuard onFailure={onFailure} />
          <SoftStage compact={compact} />
          {variant === 'robot'
            ? <Robot isSpeaking={isSpeaking} isThinking={isThinking} isListening={isListening} greeting={greeting} reducedMotion={reducedMotion} onReady={onReady} onFailure={onFailure} />
            : <AnimeAvatar isSpeaking={isSpeaking} isThinking={isThinking} isListening={isListening} greeting={greeting} reducedMotion={reducedMotion} compact={compact} onReady={onReady} onFailure={onFailure} />}
        </Canvas>
      </AvatarErrorBoundary>}
    </div>
  )
}

