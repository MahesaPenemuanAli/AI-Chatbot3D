import { Component, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  BufferGeometry, CubicBezierCurve3, ExtrudeGeometry, Float32BufferAttribute,
  MathUtils, Matrix4, PMREMGenerator, Quaternion, Shape, Vector3,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const BRASS = '#bd9562'
const FOREST = '#183e32'
const LIME = '#d7ec99'
const UP = new Vector3(0, 1, 0)
const CONTINENTS = [
  [[-168, 65], [-135, 71], [-108, 73], [-75, 58], [-55, 51], [-80, 26], [-96, 15], [-113, 28], [-127, 47], [-153, 58]],
  [[-81, 11], [-64, 9], [-46, -5], [-35, -10], [-49, -27], [-67, -55], [-76, -33], [-81, -10]],
  [[-17, 34], [3, 37], [32, 31], [44, 11], [50, 0], [35, -24], [20, -35], [10, -15], [-3, 4], [-15, 12]],
  [[-10, 36], [-5, 57], [27, 71], [65, 68], [109, 73], [153, 60], [177, 52], [136, 37], [119, 20], [106, 6], [98, 21], [77, 8], [61, 25], [37, 32], [29, 42], [12, 42]],
  [[113, -22], [131, -12], [145, -15], [153, -28], [145, -39], [124, -34], [114, -30]],
  [[95, 5], [104, -1], [106, -6], [101, -5]],
  [[106, -6], [115, -7], [115, -9], [108, -8]],
  [[109, 7], [119, 5], [117, -4], [110, -3]],
  [[130, -2], [150, -5], [148, -10], [135, -8]],
]

function hasWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

function JourneyFallback() {
  const id = useId().replaceAll(':', '')
  return <svg viewBox="0 0 600 600" width="100%" height="100%" aria-hidden="true" style={{ maxWidth: 720, maxHeight: '90%', margin: 'auto', display: 'block' }}>
    <defs>
      <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0dab7"/><stop offset=".48" stopColor="#8b683f"/><stop offset="1" stopColor="#caa976"/></linearGradient>
      <radialGradient id={`${id}-forest`} cx=".32" cy=".25"><stop stopColor="#396551"/><stop offset="1" stopColor="#102a21"/></radialGradient>
    </defs>
    <g transform="translate(300 310) rotate(-14)">
      <ellipse rx="205" ry="178" fill="none" stroke={`url(#${id}-brass)`} strokeWidth="17"/>
      <ellipse rx="187" ry="162" fill="none" stroke="#b89a6f" strokeWidth="2"/>
      {Array.from({ length: 48 }, (_, index) => <path key={index} d={`M 0 -${index % 4 ? 167 : 158} L 0 -177`} stroke="#c6a779" strokeWidth="2" transform={`rotate(${index * 7.5})`}/>)}
      <circle r="125" fill={`url(#${id}-forest)`} stroke="#8eaa85" strokeWidth="1"/>
      <ellipse rx="64" ry="125" fill="none" stroke="#9ab48c" strokeOpacity=".45"/>
      <ellipse rx="125" ry="48" fill="none" stroke="#9ab48c" strokeOpacity=".45"/>
      <path d="M-87-53-60-83-24-77-15-48-35-19-28 9-52 25-79-2ZM21-91 58-76 93-37 55-11 29-27 8-11-13-46ZM35 41 79 31 100 66 62 89 34 70Z" fill="#9bac80" opacity=".9"/>
      <path d="M-152 22C-179-150 143-182 160-17" fill="none" stroke="#d7ec99" strokeWidth="3"/>
      <path d="m151-34 24 23-31-6 7-17Z" fill="#e6d4ae"/>
      <path d="M0-162 20-8 0 10-20-8Z" fill="#d7ec99"/>
      <path d="M0 137 17 7 0-8-17 7Z" fill="#b8935e"/>
      <circle r="13" fill={`url(#${id}-brass)`}/>
    </g>
  </svg>
}

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <JourneyFallback /> : this.props.children }
}

function SurfaceLighting({ onFailure }) {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const environment = generator.fromScene(room, 0.05)
    const previous = scene.environment
    scene.environment = environment.texture
    scene.environmentIntensity = 0.85
    invalidate()
    return () => {
      scene.environment = previous
      environment.dispose()
      room.dispose()
      generator.dispose()
    }
  }, [gl, scene, invalidate])
  useEffect(() => {
    const canvas = gl.domElement
    const lost = event => { event.preventDefault(); onFailure() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onFailure])
  return <>
    <ambientLight intensity={0.55} color="#fff4dc" />
    <directionalLight position={[-4, 5, 7]} intensity={2.8} color="#fff0d4" />
    <directionalLight position={[5, -1, 4]} intensity={0.8} color="#c3d7ae" />
    <directionalLight position={[2, 4, -5]} intensity={2.2} color="#e3bf87" />
  </>
}

function sphericalPoint(longitude, latitude, radius = 1.016) {
  const lon = MathUtils.degToRad(longitude)
  const lat = MathUtils.degToRad(latitude)
  return new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(radius)
}

function landGeometry() {
  const positions = []
  const triangle = (a, b, c, depth) => {
    if (depth) {
      const ab = a.clone().add(b).normalize().multiplyScalar(1.016)
      const bc = b.clone().add(c).normalize().multiplyScalar(1.016)
      const ca = c.clone().add(a).normalize().multiplyScalar(1.016)
      triangle(a, ab, ca, depth - 1)
      triangle(ab, b, bc, depth - 1)
      triangle(ca, bc, c, depth - 1)
      triangle(ab, bc, ca, depth - 1)
    } else {
      // Winding is outward so the land is a thin enamel inlay over the globe.
      const normal = b.clone().sub(a).cross(c.clone().sub(a))
      const points = normal.dot(a) > 0 ? [a, b, c] : [a, c, b]
      points.forEach(point => positions.push(...point.toArray()))
    }
  }
  CONTINENTS.forEach(outline => {
    const points = outline.map(([lon, lat]) => sphericalPoint(lon, lat))
    const center = points.reduce((sum, point) => sum.add(point), new Vector3()).normalize().multiplyScalar(1.016)
    points.forEach((point, index) => triangle(center, point, points[(index + 1) % points.length], 2))
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function DialMarks() {
  const marks = useRef(null)
  useEffect(() => {
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    for (let index = 0; index < 72; index += 1) {
      const angle = index / 72 * Math.PI * 2
      position.set(Math.sin(angle) * 1.62, Math.cos(angle) * 1.62, 0.14)
      rotation.setFromAxisAngle(new Vector3(0, 0, 1), -angle)
      scale.set(index % 6 === 0 ? 0.032 : 0.018, index % 6 === 0 ? 0.16 : 0.07, 0.035)
      marks.current.setMatrixAt(index, matrix.compose(position, rotation, scale))
    }
    marks.current.instanceMatrix.needsUpdate = true
  }, [])
  return <instancedMesh ref={marks} args={[undefined, undefined, 72]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#d6bb8d" metalness={0.78} roughness={0.33} />
  </instancedMesh>
}

function Instrument({ progressRef, active, reducedMotion }) {
  const object = useRef(null)
  const globe = useRef(null)
  const airplane = useRef(null)
  const needle = useRef(null)
  const pointer = useRef({ x: 0, y: 0 })
  const time = useRef(0)
  const { size, viewport, invalidate } = useThree()
  const land = useMemo(landGeometry, [])
  const route = useMemo(() => new CubicBezierCurve3(new Vector3(-1.42, -0.12, 0.72), new Vector3(-1.8, 1.7, 1.4), new Vector3(1.12, 1.8, 1.5), new Vector3(1.5, -0.3, 0.7)), [])
  const shapes = useMemo(() => {
    const plane = new Shape()
    plane.moveTo(0, 0.22)
    plane.lineTo(0.045, 0.04)
    plane.lineTo(0.19, -0.065)
    plane.lineTo(0.19, -0.11)
    plane.lineTo(0.035, -0.05)
    plane.lineTo(0.025, -0.16)
    plane.lineTo(0.09, -0.2)
    plane.lineTo(0.09, -0.23)
    plane.lineTo(0, -0.2)
    plane.lineTo(-0.09, -0.23)
    plane.lineTo(-0.09, -0.2)
    plane.lineTo(-0.025, -0.16)
    plane.lineTo(-0.035, -0.05)
    plane.lineTo(-0.19, -0.11)
    plane.lineTo(-0.19, -0.065)
    plane.lineTo(-0.045, 0.04)
    plane.closePath()
    const arrow = new Shape()
    arrow.moveTo(0, 1.4)
    arrow.lineTo(-0.13, 0.05)
    arrow.lineTo(0, -0.08)
    arrow.lineTo(0.13, 0.05)
    arrow.closePath()
    return [
      new ExtrudeGeometry(plane, { depth: 0.035, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.009, bevelSegments: 1, steps: 1 }),
      new ExtrudeGeometry(arrow, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, steps: 1 }),
    ]
  }, [])
  const routePoint = useMemo(() => new Vector3(), [])
  const routeTangent = useMemo(() => new Vector3(), [])
  useEffect(() => () => { land.dispose(); shapes.forEach(shape => shape.dispose()) }, [land, shapes])

  useEffect(() => {
    if (!active) return
    let frame
    const redraw = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = null; invalidate() })
    }
    const move = event => {
      pointer.current.x = event.clientX / size.width * 2 - 1
      pointer.current.y = -(event.clientY / size.height * 2 - 1)
    }
    if (reducedMotion) window.addEventListener('scroll', redraw, { passive: true })
    else window.addEventListener('pointermove', move, { passive: true })
    invalidate()
    return () => {
      window.removeEventListener('scroll', redraw)
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [active, reducedMotion, size.width, size.height, invalidate])

  useFrame((_, rawDelta) => {
    if (!object.current || !active || document.hidden) return
    const delta = Math.min(rawDelta, 0.05)
    if (!reducedMotion) time.current += delta
    const t = reducedMotion ? 0 : time.current
    const progress = MathUtils.clamp(progressRef?.current || 0, 0, 1)
    const mobile = size.width < 640
    // Reach the copy-free side before the planning paragraph enters the viewport,
    // and stay there until that paragraph has scrolled away.
    const interpolate = (first, middle, last) => {
      if (progress < 0.36) return MathUtils.lerp(first, middle, MathUtils.smoothstep(progress / 0.36, 0, 1))
      if (progress > 0.72) return MathUtils.lerp(middle, last, MathUtils.smoothstep((progress - 0.72) / 0.28, 0, 1))
      return middle
    }
    const fit = mobile ? Math.min(0.72, viewport.width / 5.15) : Math.min(1, viewport.width / 8)
    const x = mobile ? interpolate(0.08, -0.12, 0) : interpolate(viewport.width * 0.19, -viewport.width * 0.2, 0)
    const y = mobile ? interpolate(-1.68, -1.52, -0.8) : interpolate(0.02, -0.12, -0.58)
    const scale = fit * (mobile ? interpolate(0.82, 0.88, 1.08) : interpolate(1, 0.87, 1.2))
    const tiltX = reducedMotion ? 0 : pointer.current.y * 0.055
    const tiltY = reducedMotion ? 0 : pointer.current.x * 0.065
    const approach = (current, target, rate = 10) => reducedMotion ? target : MathUtils.damp(current, target, rate, delta)
    object.current.position.x = approach(object.current.position.x, x)
    object.current.position.y = approach(object.current.position.y, y)
    object.current.scale.setScalar(approach(object.current.scale.x, scale))
    object.current.rotation.x = approach(object.current.rotation.x, interpolate(0.3, -0.27, 0.12) + tiltX, 6)
    object.current.rotation.y = approach(object.current.rotation.y, interpolate(-0.42, 0.62, -0.16) + tiltY, 6)
    object.current.rotation.z = approach(object.current.rotation.z, interpolate(-0.18, 0.24, -0.1), 6)
    globe.current.rotation.y = -1.65 + progress * 0.65 + t * 0.035
    needle.current.rotation.z = -0.4 + progress * 0.65 + Math.sin(t * 0.45) * 0.045
    const flight = (0.3 + progress * 0.35 + t * 0.028) % 1
    route.getPoint(flight, routePoint)
    route.getTangent(flight, routeTangent)
    airplane.current.position.copy(routePoint)
    airplane.current.quaternion.setFromUnitVectors(UP, routeTangent)
  })

  return <group ref={object} name="JourneyInstrument">
    <mesh><torusGeometry args={[1.83, 0.115, 18, 96]}/><meshPhysicalMaterial color={BRASS} metalness={0.9} roughness={0.24} clearcoat={0.25}/></mesh>
    <mesh position={[0, 0, -0.11]}><torusGeometry args={[1.77, 0.075, 12, 96]}/><meshStandardMaterial color="#765332" metalness={0.87} roughness={0.38}/></mesh>
    <mesh><torusGeometry args={[1.47, 0.027, 8, 80]}/><meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3}/></mesh>
    <mesh position={[0, 0, -0.03]}><ringGeometry args={[1.48, 1.77, 96]}/><meshStandardMaterial color="#142b23" metalness={0.4} roughness={0.42} side={2}/></mesh>
    <DialMarks />
    <mesh position={[0, 1.98, 0]}><boxGeometry args={[0.22, 0.12, 0.16]}/><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.28}/></mesh>
    <mesh position={[0, 2.12, 0]}><torusGeometry args={[0.15, 0.035, 8, 32]}/><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.28}/></mesh>
    <group ref={globe} name="JourneyGlobe">
      <mesh><sphereGeometry args={[1, 48, 32]}/><meshPhysicalMaterial color={FOREST} roughness={0.29} metalness={0.38} clearcoat={0.7} clearcoatRoughness={0.24}/></mesh>
      <mesh geometry={land}><meshStandardMaterial color="#a1b18a" roughness={0.67} metalness={0.18}/></mesh>
      {[-60, -30, 0, 30, 60].map(latitude => <mesh key={latitude} position={[0, Math.sin(MathUtils.degToRad(latitude)), 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[Math.cos(MathUtils.degToRad(latitude)) + 0.006, 0.004, 5, 64]}/><meshStandardMaterial color="#8da88a" metalness={0.5} roughness={0.5}/></mesh>)}
      {Array.from({ length: 6 }, (_, index) => <mesh key={index} rotation={[0, index * Math.PI / 6, 0]}><torusGeometry args={[1.006, 0.004, 5, 64]}/><meshStandardMaterial color="#8da88a" metalness={0.5} roughness={0.5}/></mesh>)}
    </group>
    <mesh><tubeGeometry args={[route, 80, 0.012, 6, false]}/><meshStandardMaterial color={LIME} metalness={0.25} roughness={0.42}/></mesh>
    <mesh ref={airplane} geometry={shapes[0]} name="JourneyFlight"><meshStandardMaterial color="#e0c89e" metalness={0.8} roughness={0.28}/></mesh>
    <group ref={needle} position={[0, 0, 1.12]} name="JourneyNeedle">
      <mesh geometry={shapes[1]}><meshStandardMaterial color={LIME} roughness={0.4} metalness={0.3}/></mesh>
      <mesh geometry={shapes[1]} rotation={[0, 0, Math.PI]} scale={[0.8, 0.73, 1]}><meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.8}/></mesh>
      <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.075, 16, 12]}/><meshStandardMaterial color="#f0dbb3" roughness={0.22} metalness={0.85}/></mesh>
    </group>
  </group>
}

export default function JourneyScene({ progressRef, active = true, reducedMotion = false }) {
  const [failed, setFailed] = useState(() => !hasWebGL())
  const onFailure = useRef(() => setFailed(true)).current
  return <div className="journey-scene" role="img" aria-label="Kompas dan globe tiga dimensi Nusa" data-journey-renderer={failed ? 'static' : 'webgl'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
    {failed ? <JourneyFallback /> : <SceneBoundary>
      <Canvas camera={{ position: [0, 0, 10.5], fov: 35 }} dpr={[1, 1.5]} frameloop={active && !reducedMotion ? 'always' : 'demand'} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => gl.setClearColor('#000000', 0)} fallback={<JourneyFallback />} style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <SurfaceLighting onFailure={onFailure}/>
        <Instrument progressRef={progressRef} active={active} reducedMotion={reducedMotion}/>
      </Canvas>
    </SceneBoundary>}
  </div>
}
