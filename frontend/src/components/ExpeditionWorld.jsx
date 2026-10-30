import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, CatmullRomCurve3, ExtrudeGeometry, Float32BufferAttribute, MathUtils, Object3D, Shape, Vector3 } from 'three'
import JourneyMapWorld from './JourneyMapWorld'

const C = { forest: '#173b2e', dark: '#0d271f', ivory: '#eeeedc', sage: '#a0b38b', brass: '#b49a70', lime: '#d4e99c' }
const TAU = Math.PI * 2
const LAND = [
  [[-164, 66], [-126, 72], [-72, 54], [-59, 47], [-85, 21], [-104, 17], [-124, 39]],
  [[-80, 9], [-53, 3], [-36, -9], [-62, -53], [-73, -25]],
  [[-13, 55], [23, 70], [53, 60], [89, 72], [139, 52], [165, 62], [148, 30], [119, 6], [97, 14], [76, 8], [58, 28], [30, 36]],
  [[-17, 34], [14, 36], [45, 12], [32, -31], [17, -35], [1, -4]],
  [[112, -21], [132, -12], [153, -26], [145, -39], [116, -32]],
  [[97, 4], [106, -6], [103, -7], [95, 2]], [[107, -6], [116, -7], [115, -9], [108, -8]],
  [[109, 7], [119, 4], [116, -4], [109, -2]], [[131, -2], [150, -5], [147, -10], [135, -8]],
]

function landInlay() {
  const vertices = []
  const point = ([lon, lat]) => {
    const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180
    return new Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)).multiplyScalar(1.049)
  }
  const triangle = (a, b, c, depth) => {
    if (depth) {
      const ab = a.clone().add(b).normalize().multiplyScalar(1.049), bc = b.clone().add(c).normalize().multiplyScalar(1.049), ca = c.clone().add(a).normalize().multiplyScalar(1.049)
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1); triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1)
    } else {
      const normal = b.clone().sub(a).cross(c.clone().sub(a))
      ;(normal.dot(a) > 0 ? [a, b, c] : [a, c, b]).forEach(vertex => vertices.push(...vertex.toArray()))
    }
  }
  LAND.forEach(outline => {
    const points = outline.map(point), center = points.reduce((sum, value) => sum.add(value), new Vector3()).normalize().multiplyScalar(1.049)
    points.forEach((value, index) => triangle(center, value, points[(index + 1) % points.length], 2))
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

function globeLines() {
  const vertices = []
  const line = sample => {
    let previous = sample(0)
    for (let index = 1; index <= 72; index += 1) {
      const next = sample(index / 72 * TAU)
      vertices.push(...previous, ...next)
      previous = next
    }
  }
  for (const latitude of [-Math.PI / 4, 0, Math.PI / 4]) line(angle => [Math.cos(angle) * Math.cos(latitude) * 1.043, Math.sin(latitude) * 1.043, Math.sin(angle) * Math.cos(latitude) * 1.043])
  for (const longitude of [0, Math.PI / 3, Math.PI * 2 / 3]) line(angle => [Math.cos(angle) * Math.sin(longitude) * 1.043, Math.sin(angle) * 1.043, Math.cos(angle) * Math.cos(longitude) * 1.043])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  return geometry
}

function aircraftShape() {
  const shape = new Shape()
  shape.moveTo(0, .5); shape.quadraticCurveTo(.045, .46, .06, .08)
  shape.lineTo(.43, -.15); shape.lineTo(.43, -.22); shape.lineTo(.06, -.1)
  shape.lineTo(.045, -.35); shape.lineTo(.17, -.46); shape.lineTo(.17, -.51)
  shape.lineTo(0, -.45); shape.lineTo(-.17, -.51); shape.lineTo(-.17, -.46)
  shape.lineTo(-.045, -.35); shape.lineTo(-.06, -.1); shape.lineTo(-.43, -.22)
  shape.lineTo(-.43, -.15); shape.lineTo(-.06, .08); shape.quadraticCurveTo(-.045, .46, 0, .5)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSegments: 2, bevelSize: .014, bevelThickness: .014, curveSegments: 8 })
  geometry.translate(0, 0, -.025)
  return geometry
}

function Ring({ radius, tube = .025, color = C.brass, ...props }) {
  return <mesh {...props}><torusGeometry args={[radius, tube, 10, 80]}/><meshStandardMaterial color={color} metalness={.72} roughness={.28}/></mesh>
}

function Dial() {
  const marks = useRef(null)
  useEffect(() => {
    const object = new Object3D()
    for (let index = 0; index < 60; index += 1) {
      const angle = index / 60 * TAU
      object.position.set(Math.sin(angle) * 1.55, Math.cos(angle) * 1.55, .065)
      object.rotation.set(0, 0, -angle)
      object.scale.set(index % 5 ? .017 : .026, index % 5 ? .065 : .145, .025)
      object.updateMatrix()
      marks.current.setMatrixAt(index, object.matrix)
    }
    marks.current.instanceMatrix.needsUpdate = true
    marks.current.computeBoundingSphere()
  }, [])
  return <instancedMesh ref={marks} args={[undefined, undefined, 60]}><boxGeometry args={[1, 1, 1]}/><meshStandardMaterial color={C.brass} metalness={.7} roughness={.32}/></instancedMesh>
}

const lerp = (values, chapter, blend) => MathUtils.lerp(values[chapter], values[chapter + 1], blend)

/** One expedition instrument persists through every chapter of the scroll story. */
export default function ExpeditionWorld({ active = true, reducedMotion = false, progressRef, pointerRef, interaction = 0 }) {
  const root = useRef(null), instrument = useRef(null), globe = useRef(null), dial = useRef(null), needle = useRef(null), map = useRef(null), question = useRef(null), flight = useRef(null), plane = useRef(null), voice = useRef(null)
  const time = useRef(0)
  const initialized = useRef(false)
  const mapProgress = useRef(0)
  const { camera, invalidate } = useThree()
  const inlay = useMemo(landInlay, []), grid = useMemo(globeLines, []), aircraft = useMemo(aircraftShape, [])
  const questionCurve = useMemo(() => new CatmullRomCurve3([
    new Vector3(-.38, .37, 0), new Vector3(-.31, .64, 0), new Vector3(.06, .71, 0), new Vector3(.38, .53, 0),
    new Vector3(.35, .2, 0), new Vector3(.02, -.04, 0), new Vector3(0, -.27, 0),
  ]), [])
  useEffect(() => () => { inlay.dispose(); grid.dispose(); aircraft.dispose() }, [inlay, grid, aircraft])
  useEffect(() => { invalidate() }, [active, reducedMotion, interaction, invalidate])
  useFrame((_, rawDelta) => {
    if (!active || !root.current) return
    const delta = Math.min(rawDelta, .05)
    if (!reducedMotion) time.current += delta
    const t = reducedMotion ? 0 : time.current
    const p = MathUtils.clamp(progressRef?.current || 0, 0, 1)
    const chapter = Math.min(2, Math.floor(p * 3))
    const blend = MathUtils.smootherstep(p * 3 - chapter, .13, .87)
    const mapWeight = lerp([0, 1, 0, 0], chapter, blend)
    const questionWeight = lerp([0, 0, 1, 0], chapter, blend)
    const conversationWeight = lerp([1, 0, 0, 0], chapter, blend)
    const height = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    const width = height * camera.aspect
    const mobile = window.innerWidth <= 760 || camera.aspect < .85
    const fit = mobile ? Math.min(.59, width / 5.5) : Math.min(1, width / 10.6)
    const pointer = reducedMotion ? null : pointerRef?.current
    const approach = (current, target, rate = 5) => reducedMotion || !initialized.current ? target : MathUtils.damp(current, target, rate, delta)
    const x = mobile ? 0 : lerp([width * .23, 0, -width * .235, width * .23], chapter, blend)
    const y = mobile ? lerp([-height * .29, -height * .12, -height * .32, -height * .27], chapter, blend) : lerp([-.12, -.32, -.13, -.12], chapter, blend)
    const scale = fit * lerp(mobile ? [.9, .92, .76, .94] : [.98, .98, .94, 1.04], chapter, blend)
    root.current.position.x = approach(root.current.position.x, x)
    root.current.position.y = approach(root.current.position.y, y + Math.sin(t * .45) * .015)
    root.current.scale.setScalar(approach(root.current.scale.x, scale))
    root.current.rotation.x = approach(root.current.rotation.x, lerp([.1, .04, .04, .12], chapter, blend) + (pointer?.y || 0) * .035)
    root.current.rotation.y = approach(root.current.rotation.y, lerp([-.32, -.12, .32, -.25], chapter, blend) + (pointer?.x || 0) * .06)
    root.current.rotation.z = approach(root.current.rotation.z, lerp([-.13, -.035, .1, -.1], chapter, blend))
    instrument.current.position.y = approach(instrument.current.position.y, mapWeight * .65)
    instrument.current.scale.setScalar(approach(instrument.current.scale.x, 1 - mapWeight * .46))
    dial.current.rotation.x = approach(dial.current.rotation.x, -mapWeight * .35)
    const globeScale = 1 - mapWeight * .42 - questionWeight * .49
    globe.current.scale.setScalar(approach(globe.current.scale.x, globeScale))
    globe.current.rotation.y = -1.91 + t * .025 + p * .18
    const bearing = .24 - questionWeight * Math.max(0, interaction ?? 0) * Math.PI / 2
    const difference = Math.atan2(Math.sin(bearing - needle.current.rotation.z), Math.cos(bearing - needle.current.rotation.z))
    needle.current.rotation.z = approach(needle.current.rotation.z, needle.current.rotation.z + difference, 3.8)
    question.current.scale.setScalar(Math.max(.001, questionWeight))
    question.current.visible = questionWeight > .002
    voice.current.scale.setScalar(Math.max(.001, conversationWeight))
    voice.current.visible = conversationWeight > .002
    voice.current.children.forEach((bar, index) => { bar.scale.y = reducedMotion ? 1 : .88 + Math.sin(t * 1.7 + index * .65) * .12 })
    map.current.scale.setScalar(Math.max(.001, mapWeight * .78))
    map.current.visible = mapWeight > .002
    mapProgress.current = MathUtils.smootherstep(mapWeight, 0, .8)
    const orbit = t * .13 + .5
    flight.current.rotation.x = lerp([.15, .34, .2, .39], chapter, blend)
    flight.current.scale.setScalar(1 - mapWeight * .2 - questionWeight * .1)
    plane.current.position.set(Math.cos(orbit) * 2.02, Math.sin(orbit) * 2.02, 0)
    plane.current.rotation.z = orbit
    plane.current.rotation.y = Math.sin(orbit) * .1
    plane.current.scale.setScalar(lerp([.36, .32, .3, .5], chapter, blend))
    initialized.current = true
  })
  return <group ref={root} name="NusaExpeditionInstrument">
    <group ref={instrument}>
      <group ref={dial}>
        <Ring radius={1.74} tube={.105}/>
        <Ring radius={1.73} tube={.045} position={[0, 0, -.15]} color="#756244"/>
        <mesh position={[0, 0, -.055]}><ringGeometry args={[1.4, 1.72, 80]}/><meshStandardMaterial color={C.dark} metalness={.25} roughness={.43} side={2}/></mesh>
        <Ring radius={1.42} tube={.018}/><Dial/>
        <mesh position={[0, 1.86, -.02]}><boxGeometry args={[.19, .16, .14]}/><meshStandardMaterial color={C.brass} metalness={.68} roughness={.3}/></mesh>
        <Ring radius={.13} tube={.03} position={[0, 2.04, -.02]}/>
      </group>
      <group ref={globe} position={[0, 0, .08]} rotation={[0, -1.91, 0]}>
        <mesh><sphereGeometry args={[1.04, 48, 32]}/><meshPhysicalMaterial color={C.forest} metalness={.23} roughness={.3} clearcoat={.55} clearcoatRoughness={.26}/></mesh>
        <mesh geometry={inlay}><meshStandardMaterial color={C.sage} metalness={.08} roughness={.57}/></mesh>
        <lineSegments geometry={grid}><lineBasicMaterial color={C.sage} transparent opacity={.34}/></lineSegments>
      </group>
      <group ref={needle} position={[0, 0, 1.2]} rotation={[0, 0, .24]}>
        <mesh position={[0, .48, 0]} scale={[1, 1, .35]}><coneGeometry args={[.095, 1.12, 4]}/><meshStandardMaterial color={C.lime} metalness={.2} roughness={.4}/></mesh>
        <mesh position={[0, -.39, 0]} rotation={[0, 0, Math.PI]} scale={[1, 1, .35]}><coneGeometry args={[.078, .93, 4]}/><meshStandardMaterial color={C.brass} metalness={.72} roughness={.25}/></mesh>
        <mesh position={[0, 0, .045]}><sphereGeometry args={[.065, 20, 12]}/><meshStandardMaterial color={C.ivory} metalness={.5} roughness={.27}/></mesh>
      </group>
      <group ref={question} position={[0, 0, 1.31]} scale={.001}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.87, .87, .13, 48]}/><meshStandardMaterial color={C.ivory} metalness={.06} roughness={.5}/></mesh>
        <mesh position={[0, 0, .09]}><tubeGeometry args={[questionCurve, 40, .1, 10, false]}/><meshStandardMaterial color={C.forest} roughness={.45} metalness={.08}/></mesh>
        <mesh position={[0, -.52, .09]}><sphereGeometry args={[.105, 20, 12]}/><meshStandardMaterial color={C.forest} roughness={.45}/></mesh>
      </group>
      <group ref={voice} position={[0, -.78, 1.18]}>{[.1, .19, .27, .34, .27, .19, .1].map((height, index) => <mesh key={index} position={[(index - 3) * .12, 0, 0]}><capsuleGeometry args={[.026, height, 3, 10]}/><meshStandardMaterial color={C.ivory} metalness={.08} roughness={.5}/></mesh>)}</group>
    </group>
    <group ref={map} position={[0, -.63, -.12]} scale={.001}><JourneyMapWorld active={active} reducedMotion={reducedMotion} progressRef={mapProgress}/></group>
    <group ref={flight} rotation={[.15, -.28, -.1]}>
      <Ring radius={2.02} tube={.009} color={C.brass}/>
      <group ref={plane} position={[1.77, .97, 0]} rotation={[0, 0, .5]} scale={.36}><mesh geometry={aircraft}><meshStandardMaterial color={C.ivory} metalness={.13} roughness={.35}/></mesh><mesh position={[0, .2, .044]}><boxGeometry args={[.038, .17, .02]}/><meshStandardMaterial color={C.forest}/></mesh></group>
    </group>
  </group>
}
