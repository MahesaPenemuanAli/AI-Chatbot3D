import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, PMREMGenerator, Scene } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ConversationWorld, DepartureWorld, QuestionsWorld } from './TravelWorlds'
import JourneyMapWorld from './JourneyMapWorld'
import ExpeditionWorld from './ExpeditionWorld'
import { dampValue, inspectionAngle } from '../lib/motionMath'

const worlds = { conversation: ConversationWorld, map: JourneyMapWorld, questions: QuestionsWorld, departure: DepartureWorld, expedition: ExpeditionWorld }
const bounds = { conversation: [4.4, 3.8], map: [7.5, 3.7], questions: [4.7, 4.3], departure: [5.1, 4.6] }

function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

class RendererBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function Compositor({ records, redraw, onFailure, onReady, running }) {
  const { gl, invalidate, setDpr } = useThree()
  const timing = useRef({ frames: 0, total: 0, warmup: 90, dpr: Math.min(window.devicePixelRatio || 1, 1.25) })
  const ready = useRef(false)
  useEffect(() => {
    redraw.current = invalidate
    const canvas = gl.domElement
    let pending
    let mounted = true
    const lost = event => {
      event.preventDefault()
      window.clearTimeout(pending)
      pending = window.setTimeout(() => { if (mounted && canvas.isConnected) onFailure() }, 500)
    }
    const restored = () => { window.clearTimeout(pending); invalidate() }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    return () => {
      mounted = false
      window.clearTimeout(pending)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      if (redraw.current === invalidate) redraw.current = null
    }
  }, [gl, invalidate, redraw, onFailure])
  useEffect(() => { timing.current.warmup = 60 }, [running])
  useFrame((state, rawDelta) => {
    const renderer = state.gl
    renderer.setScissorTest(false)
    renderer.clear(true, true, true)
    renderer.autoClear = false
    let drawn = false
    // Only visible stages read layout and draw. Hidden worlds retain their
    // resources without measuring bounds or triggering React state per frame.
    records.current.forEach(({ view, scene, camera }) => {
      if (!view.active || !view.track.current) return
      const rect = view.track.current.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= state.size.height || rect.right <= 0 || rect.left >= state.size.width || rect.width <= 0 || rect.height <= 0) return
      const aspect = rect.width / rect.height
      if (camera.aspect !== aspect) { camera.aspect = aspect; camera.updateProjectionMatrix() }
      renderer.setViewport(rect.left, state.size.height - rect.bottom, rect.width, rect.height)
      renderer.setScissor(rect.left, state.size.height - rect.bottom, rect.width, rect.height)
      renderer.setScissorTest(true)
      renderer.render(scene, camera)
      drawn = true
    })
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, state.size.width, state.size.height)
    if (drawn && !ready.current) { ready.current = true; onReady() }
    if (!running || document.hidden) return
    const sample = timing.current
    if (sample.warmup > 0) { sample.warmup -= 1; return }
    sample.total += Math.min(rawDelta, .1)
    sample.frames += 1
    if (sample.frames < 150) return
    const average = sample.total / sample.frames
    const ceiling = Math.min(window.devicePixelRatio || 1, 1.25)
    const target = average > .023 ? Math.max(.85, sample.dpr - .15) : average < .018 ? Math.min(ceiling, sample.dpr + .1) : sample.dpr
    if (Math.abs(target - sample.dpr) > .025) { sample.dpr = target; setDpr(target) }
    sample.total = 0
    sample.frames = 0
  }, 1)
  return null
}

function WorldRig({ view, active, reducedMotion, paused }) {
  const rig = useRef(null)
  const motion = useRef({ progress: view.progressRef.current, x: 0, y: 0, lastInspection: view.spinRef.current, inspectionTime: 3 })
  const progressRef = useRef(view.progressRef.current)
  const pointerRef = useRef({ x: 0, y: 0 })
  const { camera, invalidate } = useThree()
  const World = worlds[view.kind]
  useEffect(() => { invalidate() }, [view.interaction, active, reducedMotion, paused, invalidate])
  useFrame((_, rawDelta) => {
    if (!rig.current || !active) return
    const height = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    const [widthBound, heightBound] = bounds[view.kind] || [1, 1]
    const scale = view.kind === 'expedition' ? 1 : Math.min(view.kind === 'map' ? 1.5 : 1.3, height / heightBound, height * camera.aspect / widthBound)
    rig.current.scale.setScalar(scale)
    if (reducedMotion) { progressRef.current = view.progressRef.current; pointerRef.current.x = 0; pointerRef.current.y = 0; return }
    if (paused) return
    const delta = Math.min(rawDelta, .05)
    const state = motion.current
    state.progress = dampValue(state.progress, view.progressRef.current, 4.5, delta)
    state.x = dampValue(state.x, view.pointerRef.current.x, 4, delta)
    state.y = dampValue(state.y, view.pointerRef.current.y, 4, delta)
    progressRef.current = state.progress
    pointerRef.current.x = state.x
    pointerRef.current.y = state.y
    if (view.spinRef.current !== state.lastInspection) { state.lastInspection = view.spinRef.current; state.inspectionTime = 0 }
    state.inspectionTime += delta
    const turn = inspectionAngle(state.inspectionTime)
    rig.current.rotation.y = dampValue(rig.current.rotation.y, turn + state.x * .035, 5, delta)
    rig.current.rotation.x = dampValue(rig.current.rotation.x, -state.y * .025, 5, delta)
  })
  return <group ref={rig}><World active={active && !paused} reducedMotion={reducedMotion} progressRef={progressRef} pointerRef={pointerRef} interaction={view.interaction}/></group>
}

function SceneViewport({ view, records, active, reducedMotion, paused }) {
  const { invalidate } = useThree()
  const scene = useMemo(() => new Scene(), [])
  const camera = useMemo(() => {
    const rect = view.track.current?.getBoundingClientRect()
    const lens = new PerspectiveCamera(35, rect?.height ? rect.width / rect.height : 1, .1, 60)
    lens.position.z = 10
    return lens
  }, [view.track])
  const { gl } = useThree()
  useEffect(() => {
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const environment = generator.fromScene(room, .035)
    room.dispose()
    generator.dispose()
    scene.environment = environment.texture
    scene.environmentIntensity = .65
    let mounted = true
    // Compile before the sticky story enters the viewport when parallel
    // compilation is available, avoiding a first-scroll shader hitch.
    gl.compileAsync(scene, camera).then(() => { if (mounted) invalidate() }).catch(() => { if (mounted) invalidate() })
    return () => { mounted = false; scene.environment = null; environment.dispose() }
  }, [gl, scene, camera, invalidate])
  useLayoutEffect(() => {
    const registry = records.current
    registry.set(view.id, { view: { ...view, active }, scene, camera })
    invalidate()
    return () => { registry.delete(view.id); invalidate() }
  }, [view, active, records, scene, camera, invalidate])
  return createPortal(<>
    <ambientLight intensity={.65}/><hemisphereLight args={['#fff9ed', '#304b3a', 1.1]}/>
    <directionalLight position={[-3, 4, 6]} color="#fff5df" intensity={2.5}/>
    <directionalLight position={[4, 2, -2]} color="#deedc9" intensity={1.6}/>
    <WorldRig view={view} active={active} reducedMotion={reducedMotion} paused={paused}/>
  </>, scene, { camera, events: { enabled: false } })
}

export default function LandingRenderer({ views, pageVisible, reducedMotion, paused, redraw, onStatus }) {
  const [failed, setFailed] = useState(() => !hasWebGL())
  const records = useRef(new Map())
  const onFailure = useRef(() => { setFailed(true); onStatus('fallback') }).current
  const onReady = useRef(() => onStatus('ready')).current
  const running = pageVisible && !reducedMotion && !paused && views.some(view => view.active)
  useEffect(() => { if (failed) onStatus('fallback') }, [failed, onStatus])
  if (failed) return null
  return <div className="landing-world-renderer" aria-hidden="true"><RendererBoundary onFailure={onFailure}><Canvas
    camera={{ position: [0, 0, 10], fov: 35 }} dpr={[1, 1.25]}
    frameloop={running ? 'always' : 'demand'}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    onCreated={({ gl, setEvents }) => { gl.setClearColor('#000000', 0); setEvents({ enabled: false }) }}
    style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
    <Compositor records={records} redraw={redraw} onFailure={onFailure} onReady={onReady} running={running}/>
    {views.map(view => <SceneViewport key={view.id} view={view} records={records} active={view.active && pageVisible} reducedMotion={reducedMotion} paused={paused}/>)}
  </Canvas></RendererBoundary></div>
}
