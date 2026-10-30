import { Component, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import AnimeAvatar from './AnimeAvatar'
import NusaPortrait from './NusaPortrait'
import { getNusaCameraDistance, getNusaFrame } from '../lib/nusaFraming'

const wrapperStyle = { position: 'relative', width: '100%', height: '100%', minHeight: 0 }

function AvatarFraming({ framing }) {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    // Fit the animated silhouette horizontally as well as vertically. A fixed
    // camera clips hands in narrow canvases, especially on mobile.
    const frame = getNusaFrame(framing)
    camera.position.set(0, frame.centerY, getNusaCameraDistance(size.width / size.height, camera.fov, framing))
    camera.lookAt(0, frame.centerY, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, framing, invalidate])
  return null
}

function supportsWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

function WebGLContextGuard({ onFailure }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    let active = true
    let pending
    const onLost = event => {
      event.preventDefault()
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

function SoftStage() {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.84, .1]} scale={[1, .65, 1]}>
      <circleGeometry args={[.95, 64]}/><meshBasicMaterial color="#214538" transparent opacity={.08} depthWrite={false}/>
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.835, .1]} scale={[1, .65, 1]}>
      <circleGeometry args={[.62, 64]}/><meshBasicMaterial color="#214538" transparent opacity={.08} depthWrite={false}/>
    </mesh>
  </group>
}

function FriendlyFallback({ loading = false, framing = 'full' }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
    <NusaPortrait framing={framing} style={{ width: '100%', height: '100%', maxWidth: 600 }}/>
    {loading && <span style={{ position: 'absolute', bottom: '5%', fontSize: 12, color: '#777084', background: '#ffffffdd', borderRadius: 30, padding: '8px 14px' }}>Menyiapkan Nusa…</span>}
  </div>
}

class AvatarErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function AvatarCanvas({
  isSpeaking = false,
  isResponding = false,
  isThinking = false,
  isListening = false,
  speechActivity,
  greeting = 0,
  className = '',
  framing = 'full',
  paused = false,
  reducedMotion: requestedReducedMotion,
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
    const onPreference = event => setPrefersReducedMotion(event.matches)
    preference.addEventListener('change', onPreference)
    let inViewport = true
    const onVisibility = () => setVisible(inViewport && !document.hidden)
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting
      onVisibility()
    }, { rootMargin: '120px' }) : null
    if (root.current) observer?.observe(root.current)
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => {
      preference.removeEventListener('change', onPreference)
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
    }
  }, [])

  const status = isSpeaking ? 'sedang berbicara' : isThinking ? 'sedang berpikir' : isListening ? 'sedang mendengarkan' : isResponding ? 'sedang menjawab' : 'siap menemani'
  const fallback = <FriendlyFallback framing={framing}/>
  return <div ref={root} className={`nusa-avatar ${className}`} style={wrapperStyle} role="img" aria-label={`Nusa, karakter manusia 3D, ${status}`} data-framing={framing} data-avatar-state={isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : isResponding ? 'responding' : 'idle'}>
    {failed ? fallback : <AvatarErrorBoundary fallback={fallback}>
      {!ready && <FriendlyFallback loading framing={framing}/>}
      <Canvas
        camera={{ position: [0, .31, 10], fov: 33 }}
        dpr={[1, 1.25]}
        frameloop={!visible || reducedMotion || paused ? 'demand' : 'always'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .5s ease', position: 'relative' }}
        fallback={fallback}
        onCreated={({ gl, camera }) => { camera.lookAt(0, .2, 0); gl.setClearColor('#000000', 0) }}
      >
        <ambientLight intensity={.8}/>
        <hemisphereLight args={['#ffffff', '#b9b4d9', .5]}/>
        <directionalLight position={[-3, 5, 6]} intensity={1.2} color="#fff8f5"/>
        <directionalLight position={[4, 2, -3]} intensity={.8} color="#d9d1ff"/>
        <directionalLight position={[2, 1, 4]} intensity={.25} color="#edf5ff"/>
        <WebGLContextGuard onFailure={onFailure}/>
        <AvatarFraming framing={framing}/>
        <SoftStage/>
        <AnimeAvatar isSpeaking={isSpeaking} isResponding={isResponding} isThinking={isThinking} isListening={isListening} speechActivity={speechActivity} greeting={greeting} reducedMotion={reducedMotion} paused={paused} onReady={onReady} onFailure={onFailure}/>
      </Canvas>
    </AvatarErrorBoundary>}
  </div>
}
