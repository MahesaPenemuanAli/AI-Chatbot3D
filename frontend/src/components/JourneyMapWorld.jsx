import { useEffect, useMemo, useRef } from 'react'
import { extend, useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, MathUtils, Quaternion, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

extend({ RoundedBoxGeometry })

const C = { paper: '#ececdb', edge: '#c3cba8', water: '#64877a', shore: '#c9d6b3', land: '#64865b', hill: '#789366', forest: '#214c3b', lime: '#cee69a', brass: '#b39a72' }
const FORWARD = new Vector3(1, 0, 0)
const PIN_POSITIONS = [[-2.32, .15, .31], [-.1, .15, -.43], [2.21, .15, .18]]

function Rounded({ size, color, radius = .06, metalness = .03, roughness = .65, ...props }) {
  return <mesh {...props}><roundedBoxGeometry args={[...size, 3, radius]}/><meshStandardMaterial color={color} roughness={roughness} metalness={metalness}/></mesh>
}

function Palm({ position, scale = 1, rotation = 0 }) {
  return <group position={position} scale={scale} rotation={[0, rotation, -.1]}>
    <mesh position={[0, .25, 0]}><cylinderGeometry args={[.024, .039, .5, 8]}/><meshStandardMaterial color={C.brass} roughness={.86}/></mesh>
    {Array.from({ length: 5 }, (_, index) => <group key={index} position={[0, .5, 0]} rotation={[0, index * Math.PI * 2 / 5, 0]}><mesh position={[.13, -.026, 0]} rotation={[0, 0, -.19]} scale={[.23, .025, .065]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color={index % 2 ? C.land : C.hill} roughness={.78}/></mesh></group>)}
    <mesh position={[0, .5, 0]}><sphereGeometry args={[.052, 12, 8]}/><meshStandardMaterial color={C.forest} roughness={.8}/></mesh>
  </group>
}

function Island({ position, scale = [1, 1, 1], mountain = false, palm = false }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, .012, 0]} scale={[.72, .04, .49]}><sphereGeometry args={[1, 28, 14]}/><meshStandardMaterial color={C.shore} roughness={.7}/></mesh>
    <mesh position={[0, .045, 0]} scale={[.62, .095, .4]}><sphereGeometry args={[1, 28, 14]}/><meshStandardMaterial color={C.land} roughness={.8}/></mesh>
    <mesh position={[-.24, .04, .11]} scale={[.36, .075, .24]}><sphereGeometry args={[1, 20, 12]}/><meshStandardMaterial color={C.hill} roughness={.8}/></mesh>
    {mountain && <group position={[.1, .13, -.03]}>
      <mesh position={[0, .26, 0]}><cylinderGeometry args={[.065, .34, .58, 12]}/><meshStandardMaterial color={C.forest} roughness={.83}/></mesh>
      <mesh position={[-.25, .13, .08]}><coneGeometry args={[.24, .34, 12]}/><meshStandardMaterial color={C.hill} roughness={.83}/></mesh>
      <mesh position={[0, .555, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.065, .018, 5, 16]}/><meshStandardMaterial color={C.hill} roughness={.8}/></mesh>
    </group>}
    {palm && <Palm position={[.15, .13, -.1]} scale={.75} rotation={.3}/>}
  </group>
}

function AtlasLines({ hinges = false }) {
  const geometry = useMemo(() => {
    const points = []
    if (hinges) {
      for (const x of [-1.08, 1.08]) for (const z of [-.8, -.4, 0, .4, .8]) points.push(x, .067, z - .06, x, .067, z + .06)
    } else {
      for (const offset of [-.68, 0, .68]) points.push(offset, .058, -1.012, offset, .058, 1.012, -1.012, .058, offset, 1.012, .058, offset)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(points, 3))
    return result
  }, [hinges])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <lineSegments geometry={geometry}><lineBasicMaterial color={hinges ? C.brass : C.shore} transparent opacity={hinges ? .65 : .22}/></lineSegments>
}

function Panel({ position, children }) {
  return <group position={position}>
    <Rounded size={[2.13, .09, 2.17]} color={C.paper} radius={.045}/>
    <Rounded size={[2.005, .008, 2.045]} color={C.water} radius={.025} position={[0, .051, 0]}/>
    <AtlasLines/>
    {children}
  </group>
}

function Pin({ pinRef, position }) {
  return <group ref={pinRef} position={position} scale={.001}>
    <mesh position={[0, .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.12, .16, 32]}/><meshStandardMaterial color={C.lime} roughness={.5} side={2}/></mesh>
    <mesh position={[0, .19, 0]}><cylinderGeometry args={[.022, .022, .34, 12]}/><meshStandardMaterial color={C.brass} metalness={.6} roughness={.35}/></mesh>
    <mesh position={[0, .43, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.12, .045, 10, 28]}/><meshStandardMaterial color={C.brass} metalness={.35} roughness={.43}/></mesh>
    <mesh position={[0, .43, 0]}><sphereGeometry args={[.067, 16, 10]}/><meshStandardMaterial color={C.lime} metalness={.04} roughness={.55}/></mesh>
  </group>
}

/** An original fold-out travel diorama. Render inside the shared landing Canvas. */
export default function JourneyMapWorld({ active = true, reducedMotion = false, progressRef, pointerRef }) {
  const root = useRef(null)
  const left = useRef(null)
  const right = useRef(null)
  const plane = useRef(null)
  const pins = useRef([])
  const routeMesh = useRef(null)
  const time = useRef(0)
  const flightPhase = useRef(.1)
  const orientation = useMemo(() => new Quaternion(), [])
  const { invalidate } = useThree()
  const route = useMemo(() => new CatmullRomCurve3([
    new Vector3(-2.6, .72, .22), new Vector3(-1.4, .92, -.44),
    new Vector3(.25, 1.06, -.39), new Vector3(2.25, .84, .06),
    new Vector3(2.7, .72, .72), new Vector3(.65, .86, 1.01),
    new Vector3(-1.55, .91, .95), new Vector3(-2.8, .75, .64),
  ], true, 'centripetal'), [])
  const groundRoute = useMemo(() => new CatmullRomCurve3([
    new Vector3(-2.65, .125, .52), new Vector3(-2.32, .125, .31),
    new Vector3(-1.3, .125, -.08), new Vector3(-.1, .125, -.43),
    new Vector3(1.12, .125, -.31), new Vector3(2.21, .125, .18),
    new Vector3(2.72, .125, .58),
  ]), [])
  const point = useMemo(() => new Vector3(), [])
  const tangent = useMemo(() => new Vector3(), [])

  useEffect(() => { invalidate() }, [active, reducedMotion, invalidate])

  useFrame((_, rawDelta) => {
    if (!root.current || !active) return
    const delta = Math.min(rawDelta, .05)
    if (!reducedMotion) time.current += delta
    const t = reducedMotion ? 0 : time.current
    const progress = reducedMotion ? .8 : MathUtils.clamp(progressRef?.current ?? .5, 0, 1)
    const pointer = reducedMotion ? null : pointerRef?.current
    const unfolded = MathUtils.smootherstep(progress, .04, .68)
    const fold = MathUtils.lerp(.46, .025, unfolded)
    const approach = (current, target, speed = 4.5) => reducedMotion ? target : MathUtils.damp(current, target, speed, delta)
    left.current.rotation.z = approach(left.current.rotation.z, -fold)
    right.current.rotation.z = approach(right.current.rotation.z, fold)
    root.current.rotation.x = approach(root.current.rotation.x, 1.01 + (pointer?.y || 0) * .035)
    root.current.rotation.y = approach(root.current.rotation.y, -.14 + (pointer?.x || 0) * .045)
    root.current.rotation.z = approach(root.current.rotation.z, -.055 + Math.sin(t * .2) * .006)
    root.current.position.y = Math.sin(t * .55) * .018 - .1
    const visible = MathUtils.smootherstep(progress, .17, .48)
    routeMesh.current.material.opacity = approach(routeMesh.current.material.opacity, visible * .76)
    pins.current.forEach((pin, index) => {
      if (!pin) return
      const reveal = MathUtils.smootherstep(progress, .08 + index * .13, .31 + index * .13)
      const pulse = 1 + Math.sin(t * 1.25 - index * .85) * .014
      pin.scale.setScalar(approach(pin.scale.x, Math.max(.001, reveal * pulse), 5))
    })
    // A closed, arc-length path keeps speed and orientation continuous at every
    // lap. Scroll changes presentation, never the aircraft's flight position.
    if (!reducedMotion) flightPhase.current = (flightPhase.current + delta * .023) % 1
    const flight = reducedMotion ? .39 : flightPhase.current
    route.getPointAt(flight, point)
    route.getTangentAt(flight, tangent)
    plane.current.position.copy(point)
    orientation.setFromUnitVectors(FORWARD, tangent)
    plane.current.quaternion.slerp(orientation, reducedMotion ? 1 : 1 - Math.exp(-7 * delta))
    plane.current.scale.setScalar(approach(plane.current.scale.x, .86 + visible * .06))
    plane.current.visible = reducedMotion || progress > .15
  })

  return <group ref={root} name="NusaFoldingItinerary" rotation={[1.01, -.14, -.055]} position={[0, -.1, 0]}>
    {/* A tactile paper map with two genuine folding hinges. */}
    <Panel position={[0, 0, 0]}>
      <Island position={[-.08, .075, -.23]} scale={[1.15, 1, .92]} mountain/>
      <Island position={[.62, .075, .55]} scale={[.35, .8, .35]}/>
    </Panel>
    <group ref={left} position={[-1.08, 0, 0]} rotation={[0, 0, -.3]}>
      <Panel position={[-1.08, 0, 0]}><Island position={[.05, .075, .1]} scale={[1.15, .9, .78]} palm/><Island position={[-.58, .075, -.53]} scale={[.4, .65, .38]}/></Panel>
      <Pin pinRef={node => { pins.current[0] = node }} position={[-1.24, .15, .31]}/>
    </group>
    <group ref={right} position={[1.08, 0, 0]} rotation={[0, 0, .3]}>
      <Panel position={[1.08, 0, 0]}><Island position={[.08, .075, .14]} scale={[1.05, .9, .8]} palm/><Island position={[-.49, .075, -.6]} scale={[.37, .7, .33]}/></Panel>
      <Pin pinRef={node => { pins.current[2] = node }} position={[1.13, .15, .18]}/>
    </group>
    <Pin pinRef={node => { pins.current[1] = node }} position={PIN_POSITIONS[1]}/>
    <mesh ref={routeMesh}><tubeGeometry args={[groundRoute, 72, .015, 5, false]}/><meshStandardMaterial color={C.lime} emissive={C.lime} emissiveIntensity={.2} transparent opacity={.8}/></mesh>
    {/* Printed stitching is one draw call rather than ten tiny solid boxes. */}
    <AtlasLines hinges/>
    <group position={[-.79, .08, -.79]}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.12, .13, 32]}/><meshStandardMaterial color={C.paper} roughness={.6} side={2}/></mesh><mesh position={[0, .02, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[.042, .21, 3]}/><meshStandardMaterial color={C.lime}/></mesh></group>
    <group ref={plane} name="NusaItineraryFlight" position={[1.4, .85, -.25]}>
      <mesh rotation={[0, 0, -Math.PI / 2]}><capsuleGeometry args={[.045, .36, 4, 12]}/><meshStandardMaterial color={C.paper} roughness={.3} metalness={.28}/></mesh>
      <Rounded size={[.18, .025, .44]} radius={.012} position={[-.025, 0, 0]} color={C.brass} metalness={.6} roughness={.3}/>
      <Rounded size={[.1, .022, .18]} radius={.01} position={[-.17, .025, 0]} color={C.brass} metalness={.6} roughness={.3}/>
      <mesh position={[-.18, .06, 0]}><boxGeometry args={[.08, .13, .018]}/><meshStandardMaterial color={C.lime} roughness={.4}/></mesh>
    </group>
  </group>
}
