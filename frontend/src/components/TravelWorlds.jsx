import { useEffect, useMemo, useRef } from 'react'
import { extend, useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, CatmullRomCurve3, ExtrudeGeometry, Float32BufferAttribute, MathUtils, Object3D, Shape, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

extend({ RoundedBoxGeometry })

const C = { forest: '#173e30', deep: '#0b281f', lime: '#d4f481', ivory: '#f2eedc', sage: '#8da879', brass: '#b99a69', pale: '#c5d6ae' }
const clamp = value => MathUtils.clamp(value || 0, 0, 1)

function Block({ dimensions, radius = .09, color = C.ivory, metalness = .06, roughness = .48, ...props }) {
  return <mesh {...props}><roundedBoxGeometry args={[...dimensions, 3, radius]}/><meshStandardMaterial color={color} roughness={roughness} metalness={metalness}/></mesh>
}

function Ball({ radius = .08, color = C.lime, glow = false, ...props }) {
  return <mesh {...props}><sphereGeometry args={[radius, 20, 14]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? .16 : 0} metalness={.08} roughness={.43}/></mesh>
}

function Loop({ radius, tube = .025, color = C.brass, ...props }) {
  return <mesh {...props}><torusGeometry args={[radius, tube, 8, 64]}/><meshStandardMaterial color={color} metalness={.48} roughness={.4}/></mesh>
}

function useRefresh(active, reducedMotion, interaction) {
  const { invalidate } = useThree()
  useEffect(() => { invalidate() }, [invalidate, active, reducedMotion, interaction])
}

function bubbleGeometry(width, height, tail = -1) {
  const shape = new Shape()
  const x = -width / 2, y = -height / 2, r = .2
  shape.moveTo(x + r, y)
  if (tail < 0) {
    shape.lineTo(x + .27, y)
    shape.lineTo(x + .22, y - .3)
    shape.lineTo(x + .66, y)
  } else {
    shape.lineTo(width / 2 - .66, y)
    shape.lineTo(width / 2 - .22, y - .3)
    shape.lineTo(width / 2 - .27, y)
  }
  shape.lineTo(width / 2 - r, y)
  shape.quadraticCurveTo(width / 2, y, width / 2, y + r)
  shape.lineTo(width / 2, height / 2 - r)
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2)
  shape.lineTo(x + r, height / 2)
  shape.quadraticCurveTo(x, height / 2, x, height / 2 - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: .16, bevelEnabled: true, bevelSegments: 3, bevelSize: .055, bevelThickness: .055, curveSegments: 10 })
  geometry.translate(0, 0, -.08)
  return geometry
}

/** A quiet, sculptural conversation: two floating enamel speech bubbles. */
export function ConversationWorld({ active = true, reducedMotion = false, progressRef, pointerRef }) {
  const world = useRef(null), first = useRef(null), second = useRef(null), dots = useRef(null), waves = useRef(null)
  const time = useRef(0)
  const bubbles = useMemo(() => [bubbleGeometry(2.36, 1.25, -1), bubbleGeometry(2.05, 1.12, 1)], [])
  useEffect(() => () => bubbles.forEach(geometry => geometry.dispose()), [bubbles])
  useRefresh(active, reducedMotion)
  useFrame((_, rawDelta) => {
    if (!active || reducedMotion || !world.current) return
    const delta = Math.min(rawDelta, .05)
    time.current += delta
    const t = time.current, progress = clamp(progressRef?.current), pointer = pointerRef?.current
    world.current.rotation.y = MathUtils.damp(world.current.rotation.y, -.21 + (pointer?.x || 0) * .07 + (progress - .5) * .12, 3.8, delta)
    world.current.rotation.x = MathUtils.damp(world.current.rotation.x, .055 + (pointer?.y || 0) * .035, 3.8, delta)
    first.current.position.y = .57 + Math.sin(t * .68) * .045
    first.current.rotation.z = -.075 + Math.sin(t * .46) * .014
    second.current.position.y = -.48 + Math.sin(t * .68 + 1.7) * .045
    second.current.rotation.z = .09 + Math.sin(t * .46 + 1.7) * .014
    dots.current.children.forEach((dot, index) => { dot.position.y = Math.sin(t * 2 - index * .8) * .025 })
    waves.current.children.forEach((bar, index) => { bar.scale.y = .85 + Math.sin(t * 1.65 + index * .65) * .15 })
  })
  return <group ref={world} rotation={[.055, -.21, 0]} name="NusaConversationWorld">
    <Loop radius={1.82} tube={.014} position={[0, .02, -.65]} rotation={[.18, .35, -.2]} color={C.brass}/>
    <group ref={first} position={[-.4, .57, .02]} rotation={[.05, .05, -.075]}>
      <mesh geometry={bubbles[0]}><meshStandardMaterial color={C.ivory} roughness={.4} metalness={.06}/></mesh>
      <group ref={dots} position={[-.46, -.03, .18]}>{[0, 1, 2].map(index => <Ball key={index} position={[index * .43, 0, 0]} radius={.11} color={C.forest}/>)}</group>
      <Block dimensions={[.72, .055, .035]} radius={.02} position={[-.49, .35, .18]} color={C.sage}/>
    </group>
    <group ref={second} position={[.53, -.48, .48]} rotation={[-.04, -.04, .09]}>
      <mesh geometry={bubbles[1]}><meshStandardMaterial color={C.forest} roughness={.38} metalness={.09}/></mesh>
      <group ref={waves} position={[-.64, .035, .19]}>{[.22, .43, .68, .85, .58, .32, .18].map((height, index) => <Block key={index} dimensions={[.095, height, .09]} radius={.045} position={[index * .21, 0, 0]} color={C.lime}/>)}</group>
    </group>
  </group>
}

function AnswerMarker({ index, selected, active, reducedMotion }) {
  const angle = index * Math.PI / 2 + .45
  const plate = useRef(null)
  const target = useRef(.3)
  useEffect(() => { if (reducedMotion && plate.current) plate.current.position.z = selected ? .46 : .3 }, [reducedMotion, selected])
  useFrame((_, delta) => {
    if (!plate.current || !active || reducedMotion) return
    target.current = MathUtils.damp(target.current, selected ? .46 : .3, 4, Math.min(delta, .05))
    plate.current.position.z = target.current
  })
  return <group ref={plate} position={[Math.sin(angle) * 1.69, Math.cos(angle) * 1.69, .3]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.22, .22, .09, 32]}/><meshStandardMaterial color={selected ? C.lime : C.ivory} roughness={.5} metalness={.05}/></mesh>
    <Ball position={[0, 0, .075]} radius={.058} color={selected ? C.forest : C.sage}/>
  </group>
}

function DialTicks() {
  const ticks = useRef(null)
  useEffect(() => {
    const object = new Object3D()
    for (let index = 0; index < 24; index += 1) {
      const angle = index * Math.PI / 12
      object.position.set(Math.sin(angle) * 1.315, Math.cos(angle) * 1.315, 0)
      object.rotation.set(0, 0, -angle)
      object.scale.set(.022, index % 6 === 0 ? .14 : .055, .035)
      object.updateMatrix()
      ticks.current.setMatrixAt(index, object.matrix)
    }
    ticks.current.instanceMatrix.needsUpdate = true
    ticks.current.computeBoundingSphere()
  }, [])
  return <instancedMesh ref={ticks} args={[undefined, undefined, 24]}><boxGeometry args={[1, 1, 1]}/><meshStandardMaterial color={C.forest} roughness={.65}/></instancedMesh>
}

/** A sculptural question medallion with a needle that gently finds each answer. */
export function QuestionsWorld({ active = true, reducedMotion = false, progressRef, interaction = 0, pointerRef }) {
  const world = useRef(null), emblem = useRef(null), needle = useRef(null)
  const time = useRef(0)
  const question = useMemo(() => new CatmullRomCurve3([
    new Vector3(-.5, .57, .18), new Vector3(-.44, .91, .18), new Vector3(.04, 1.04, .18),
    new Vector3(.49, .85, .18), new Vector3(.49, .42, .18), new Vector3(.1, .11, .18), new Vector3(.04, -.24, .18),
  ]), [])
  const selected = interaction == null ? -1 : interaction
  useRefresh(active, reducedMotion, interaction)
  useEffect(() => {
    if (reducedMotion && needle.current) needle.current.rotation.z = -(Math.max(0, selected) * Math.PI / 2) - .45
  }, [reducedMotion, selected])
  useFrame((_, rawDelta) => {
    if (!active || reducedMotion || !world.current) return
    const delta = Math.min(rawDelta, .05)
    time.current += delta
    const t = time.current, progress = clamp(progressRef?.current), pointer = pointerRef?.current
    world.current.rotation.y = MathUtils.damp(world.current.rotation.y, -.2 + (pointer?.x || 0) * .07 + (progress - .5) * .1, 3.8, delta)
    world.current.rotation.x = MathUtils.damp(world.current.rotation.x, .12 + (pointer?.y || 0) * .04, 3.8, delta)
    emblem.current.position.y = Math.sin(t * .65) * .025
    const bearing = -(Math.max(0, selected) * Math.PI / 2) - .45
    const difference = Math.atan2(Math.sin(bearing - needle.current.rotation.z), Math.cos(bearing - needle.current.rotation.z))
    needle.current.rotation.z = MathUtils.damp(needle.current.rotation.z, needle.current.rotation.z + difference, 3.2, delta)
  })
  return <group ref={world} rotation={[.12, -.2, 0]} name="NusaQuestionsWorld">
    <Loop radius={1.43} tube={.045} color={C.brass} position={[0, 0, -.14]}/>
    <Loop radius={1.67} tube={.012} color={C.sage} position={[0, 0, -.17]}/>
    <group position={[0, 0, -.08]}><DialTicks/></group>
    <group ref={needle} position={[0, 0, -.03]} rotation={[0, 0, -.45]}>
      <mesh position={[0, 1.3, 0]}><coneGeometry args={[.075, .23, 3]}/><meshStandardMaterial color={C.brass} roughness={.4} metalness={.5}/></mesh>
    </group>
    <group ref={emblem}>
      <mesh position={[0, .05, -.16]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.1, 1.1, .2, 48]}/><meshStandardMaterial color={C.ivory} roughness={.52}/></mesh>
      <mesh><tubeGeometry args={[question, 48, .14, 10, false]}/><meshStandardMaterial color={C.forest} metalness={.08} roughness={.4}/></mesh>
      <Ball position={[.04, -.65, .18]} radius={.145} color={C.forest}/>
    </group>
    {[0, 1, 2, 3].map(index => <AnswerMarker key={index} index={index} selected={selected === index} active={active} reducedMotion={reducedMotion}/>)}
  </group>
}

const LAND = [
  [[-166, 65], [-127, 73], [-74, 55], [-59, 47], [-85, 21], [-104, 17], [-124, 39]],
  [[-80, 9], [-53, 3], [-36, -9], [-62, -53], [-73, -25]],
  [[-13, 55], [23, 70], [53, 60], [89, 72], [139, 52], [167, 62], [148, 30], [119, 6], [97, 14], [76, 8], [58, 28], [30, 36]],
  [[-17, 34], [14, 36], [45, 12], [32, -31], [17, -35], [1, -4]],
  [[112, -21], [132, -12], [153, -26], [145, -39], [116, -32]],
  [[97, 4], [106, -6], [103, -7], [95, 2]], [[107, -6], [116, -7], [115, -9], [108, -8]],
  [[109, 7], [119, 4], [116, -4], [109, -2]], [[131, -2], [150, -5], [147, -10], [135, -8]],
]

function enamelLand() {
  const vertices = []
  const point = ([longitude, latitude]) => {
    const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180
    return new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(1.073)
  }
  const triangle = (a, b, c, depth) => {
    if (depth) {
      const ab = a.clone().add(b).normalize().multiplyScalar(1.073), bc = b.clone().add(c).normalize().multiplyScalar(1.073), ca = c.clone().add(a).normalize().multiplyScalar(1.073)
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1); triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1)
      return
    }
    const normal = b.clone().sub(a).cross(c.clone().sub(a))
    const points = normal.dot(a) > 0 ? [a, b, c] : [a, c, b]
    points.forEach(vertex => vertices.push(...vertex.toArray()))
  }
  LAND.forEach(outline => {
    const points = outline.map(point), center = points.reduce((sum, value) => sum.add(value), new Vector3()).normalize().multiplyScalar(1.073)
    points.forEach((value, index) => triangle(center, value, points[(index + 1) % points.length], 2))
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

function planeGeometry() {
  const plane = new Shape()
  plane.moveTo(0, .49); plane.quadraticCurveTo(.055, .45, .07, .08)
  plane.lineTo(.47, -.16); plane.lineTo(.47, -.25); plane.lineTo(.07, -.12)
  plane.lineTo(.06, -.37); plane.lineTo(.19, -.48); plane.lineTo(.19, -.54)
  plane.lineTo(0, -.47); plane.lineTo(-.19, -.54); plane.lineTo(-.19, -.48)
  plane.lineTo(-.06, -.37); plane.lineTo(-.07, -.12); plane.lineTo(-.47, -.25)
  plane.lineTo(-.47, -.16); plane.lineTo(-.07, .08); plane.quadraticCurveTo(-.055, .45, 0, .49)
  const geometry = new ExtrudeGeometry(plane, { depth: .07, bevelEnabled: true, bevelSegments: 2, bevelSize: .018, bevelThickness: .018, curveSegments: 8 })
  geometry.translate(0, 0, -.035)
  return geometry
}

/** Enamel globe, armillary rings, and a real extruded airplane following its route. */
export function DepartureWorld({ active = true, reducedMotion = false, progressRef, pointerRef }) {
  const world = useRef(null), globe = useRef(null), plane = useRef(null)
  const time = useRef(0)
  const land = useMemo(enamelLand, []), aircraft = useMemo(planeGeometry, [])
  useEffect(() => () => { land.dispose(); aircraft.dispose() }, [land, aircraft])
  useRefresh(active, reducedMotion)
  useFrame((_, rawDelta) => {
    if (!active || reducedMotion || !world.current) return
    const delta = Math.min(rawDelta, .05)
    time.current += delta
    const t = time.current, progress = clamp(progressRef?.current), pointer = pointerRef?.current
    world.current.rotation.x = MathUtils.damp(world.current.rotation.x, -.12 + (pointer?.y || 0) * .045, 3.8, delta)
    world.current.rotation.y = MathUtils.damp(world.current.rotation.y, -.2 + (pointer?.x || 0) * .07 + (progress - .5) * .2, 3.8, delta)
    world.current.position.y = Math.sin(t * .55) * .035
    globe.current.rotation.y = -1.6 + t * .035 + progress * .16
    const angle = t * .16 + progress * .35 + .35
    plane.current.position.set(Math.cos(angle) * 1.95, Math.sin(angle) * 1.95, 0)
    plane.current.rotation.z = angle
    plane.current.rotation.y = Math.sin(angle) * .1
  })
  return <group ref={world} rotation={[-.12, -.2, 0]} name="NusaDepartureWorld">
    <group ref={globe} rotation={[0, -1.6, 0]}>
      <mesh><sphereGeometry args={[1.06, 40, 28]}/><meshStandardMaterial color={C.forest} metalness={.14} roughness={.38}/></mesh>
      <mesh geometry={land}><meshStandardMaterial color={C.pale} metalness={.05} roughness={.58}/></mesh>
      {[-Math.PI / 4, 0, Math.PI / 4].map(latitude => <Loop key={latitude} radius={Math.cos(latitude) * 1.065} tube={.004} position={[0, Math.sin(latitude) * 1.065, 0]} rotation={[Math.PI / 2, 0, 0]} color={C.sage}/>)}
      {[0, 1, 2].map(index => <Loop key={index} radius={1.065} tube={.004} rotation={[0, index * Math.PI / 3, 0]} color={C.sage}/>)}
    </group>
    <Loop radius={1.4} tube={.032} color={C.brass} rotation={[.15, -.4, -.4]}/>
    <group rotation={[.35, -.35, -.2]}>
      <Loop radius={1.95} tube={.012} color={C.brass}/>
      <group ref={plane} position={[1.832, .669, 0]} rotation={[0, 0, .35]} scale={.67}>
        <mesh geometry={aircraft}><meshStandardMaterial color={C.ivory} metalness={.08} roughness={.4}/></mesh>
        <Block dimensions={[.06, .23, .035]} radius={.02} color={C.forest} position={[0, .17, .065]}/>
        <Block dimensions={[.055, .31, .16]} radius={.025} color={C.lime} position={[0, -.28, .05]}/>
      </group>
    </group>
  </group>
}
