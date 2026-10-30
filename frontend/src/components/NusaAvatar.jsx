import { useEffect, useMemo, useRef } from 'react'
import { extend, useFrame, useThree } from '@react-three/fiber'
import { CatmullRomCurve3, MathUtils, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { gestureEnvelope, nusaWavePose, speechEnergy } from '../lib/nusaMotion'
import { getNusaArmPose, NUSA_RIG } from '../lib/nusaRig'

extend({ RoundedBoxGeometry })

const C = {
  skin: '#c98b66', skinLight: '#db9e78', skinShade: '#b57152', lip: '#884d42',
  hair: '#24251f', hairLight: '#34372b', forest: '#345541', moss: '#6b7959',
  dark: '#203a2c', cream: '#f0ead8', lime: '#cee39a', trousers: '#a7a48a', sole: '#7b8163',
}

function Box({ size, radius = .08, color = C.forest, roughness = .75, ...props }) {
  return <mesh {...props}><roundedBoxGeometry args={[...size, 4, Math.min(radius, ...size.map(value => value / 2))]}/><meshStandardMaterial color={color} roughness={roughness}/></mesh>
}
function Orb({ scale, color = C.skin, roughness = .72, ...props }) {
  return <mesh scale={scale} {...props}><sphereGeometry args={[1, 28, 20]}/><meshStandardMaterial color={color} roughness={roughness}/></mesh>
}
function Limb({ length, radius, color = C.forest, ...props }) {
  return <mesh {...props}><capsuleGeometry args={[radius, Math.max(.01, length - radius * 2), 6, 16]}/><meshStandardMaterial color={color} roughness={.85}/></mesh>
}
function Stroke({ points, radius = .012, color = C.dark, ...props }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(point => new Vector3(...point))), [points])
  return <mesh {...props}><tubeGeometry args={[curve, 16, radius, 6, false]}/><meshStandardMaterial color={color} roughness={.7}/></mesh>
}

function Hand({ side }) {
  return <group>
    <Orb position={[0, -.105, 0]} scale={[.105, .145, .063]} color={C.skinLight}/>
    {[-1.5, -.5, .5, 1.5].map((finger, index) => {
      const length = [.13, .17, .16, .12][index]
      return <group key={finger} position={[finger * .047, -.195, .005]} rotation={[.11, 0, -finger * .035]}>
        <Limb position={[0, -length / 2, 0]} length={length} radius={.025} color={C.skinLight}/>
        <Limb position={[0, -length + .005, .012]} rotation={[-.17, 0, 0]} length={.065} radius={.022} color={C.skin}/>
      </group>
    })}
    <Limb position={[-side * .106, -.1, .04]} rotation={[.1, 0, -side * .65]} length={.17} radius={.037} color={C.skinLight}/>
    <Stroke points={[[-.055, -.09, .06], [0, -.115, .066], [.06, -.08, .06]]} radius={.0035} color={C.skinShade}/>
  </group>
}

function Arm({ side, armRef, elbowRef, wristRef }) {
  return <group ref={armRef} position={[side * NUSA_RIG.shoulderX, NUSA_RIG.shoulderY, NUSA_RIG.shoulderZ]} rotation={[0, 0, side * .13]}>
    <Orb scale={[.175, .17, .16]} color={C.forest}/>
    <Limb position={[0, -.34, 0]} length={.74} radius={.145}/>
    <Stroke points={[[side * .14, -.12, .045], [side * .148, -.35, .045], [side * .115, -.58, .045]]} radius={.008} color={C.moss}/>
    <group ref={elbowRef} position={[0, NUSA_RIG.elbowY, NUSA_RIG.elbowZ]}>
      <Orb scale={[.115, .12, .12]} color={C.forest}/>
      <Limb position={[0, -.265, .02]} length={.57} radius={.112}/>
      <Box position={[0, -.49, .02]} size={[.24, .14, .245]} radius={.045} color={C.moss}/>
      <Limb position={[0, -.585, .025]} length={.19} radius={.085} color={C.skin}/>
      <group ref={wristRef} position={[0, NUSA_RIG.wristY, NUSA_RIG.wristZ]}><Hand side={side}/></group>
    </group>
  </group>
}

function Jacket() {
  const silhouette = useMemo(() => [[.32, -.68], [.42, -.66], [.465, -.4], [.46, -.04], [.53, .52], [.54, .78], [.44, .93], [.19, 1.02]].map(([radius, y]) => new Vector2(radius, y)), [])
  return <group>
    <mesh scale={[1, 1, .65]}><latheGeometry args={[silhouette, 36]}/><meshStandardMaterial color={C.forest} roughness={.9}/></mesh>
    <Box position={[0, .60, .315]} size={[.38, .62, .055]} radius={.08} color={C.cream}/>
    <Box position={[0, -.11, .323]} size={[.038, 1.04, .025]} radius={.009} color={C.dark}/>
    <Box position={[.015, .29, .356]} size={[.055, .095, .025]} radius={.014} color="#b9bd91"/>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * .23, .80, .315]} rotation={[0, 0, side * .48]} size={[.25, .49, .095]} radius={.045} color={C.dark}/>
      <Box position={[side * .30, .27, .313]} rotation={[0, side * -.17, 0]} size={[.29, .28, .072]} radius={.045} color={C.moss}/>
      <Box position={[side * .30, .405, .356]} size={[.31, .065, .04]} radius={.015} color={C.forest}/>
      <Box position={[side * .28, -.42, .287]} rotation={[0, 0, side * -.10]} size={[.28, .24, .055]} radius={.04} color={C.forest}/>
      <Stroke points={[[side * .14, -.34, .322], [side * .28, -.31, .33], [side * .41, -.35, .30]]} color={C.moss} radius={.008}/>
    </group>)}
    <Box position={[0, -.635, .018]} size={[.83, .10, .58]} radius={.04} color={C.dark}/>
    {/* A small compass pin, retained from Nusa's original travel identity. */}
    <group position={[-.30, .29, .371]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.075, .075, .022, 24]}/><meshStandardMaterial color={C.cream} roughness={.6}/></mesh>
      <mesh position={[0, .012, .018]}><coneGeometry args={[.028, .085, 3]}/><meshStandardMaterial color={C.forest}/></mesh>
    </group>
    <Box position={[0, .03, -.32]} size={[.84, 1.22, .31]} radius={.16} color={C.moss}/>
    {[-1, 1].map(side => <Stroke key={side} points={[[side * .34, .90, -.12], [side * .40, .61, .26], [side * .405, .04, .30], [side * .39, -.43, .22]]} radius={.045} color={C.dark}/>)}
    <mesh position={[0, 1.045, .015]} rotation={[Math.PI / 2, 0, 0]} scale={[1, .80, 1]}><torusGeometry args={[.20, .065, 8, 28]}/><meshStandardMaterial color={C.lime} roughness={1}/></mesh>
    <Box position={[-.15, .73, .357]} rotation={[0, 0, -.18]} size={[.15, .45, .045]} radius={.025} color={C.lime}/>
  </group>
}

function TrouserLeg() {
  const points = useMemo(() => [[.145,-2.64],[.15,-2.40],[.16,-1.85],[.175,-1.64],[.20,-1.28],[.215,-.86],[.19,-.58]].map(([radius,y]) => new Vector2(radius,y)), [])
  return <mesh><latheGeometry args={[points,28]}/><meshStandardMaterial color={C.trousers} roughness={.94}/></mesh>
}

/** Original stylized human travel companion. All geometry is authored locally. */
export default function NusaAvatar({ isSpeaking, isResponding = false, isThinking, isListening, speechActivity, greeting, reducedMotion, paused = false, onReady }) {
  const body = useRef(null), head = useRef(null), eyes = useRef(null), brows = useRef(null), mouth = useRef(null)
  const rightArm = useRef(null), leftArm = useRef(null), rightElbow = useRef(null), leftElbow = useRef(null), rightWrist = useRef(null), leftWrist = useRef(null)
  const time = useRef(0), waveStart = useRef(0), busy = useRef(false)
  const smoothing = useRef({ speaking: 0, responding: 0, thinking: 0, listening: 0, mouth: 0 })
  const blink = useRef({ next: 2.4, start: -10, double: false })
  const gaze = useRef({ next: 1.8, x: 0, y: 0 })
  const gesture = useRef({ next: 0, start: -10, duration: 1.4, side: 1 })
  const { pointer, invalidate } = useThree()

  useEffect(() => { onReady(); invalidate() }, [onReady, invalidate])
  useEffect(() => { busy.current = isSpeaking || isResponding || isThinking || isListening || reducedMotion }, [isSpeaking, isResponding, isThinking, isListening, reducedMotion])
  useEffect(() => { waveStart.current = busy.current ? -Infinity : time.current; invalidate() }, [greeting, invalidate])
  useEffect(() => {
    if (isSpeaking || isResponding || isThinking || isListening || reducedMotion) waveStart.current = -Infinity
    if (isSpeaking || isResponding) gesture.current.next = time.current
    if (reducedMotion) {
      body.current.position.y = 0; body.current.rotation.set(0, -.08, 0)
      head.current.rotation.set(0, 0, -.025)
      leftArm.current.rotation.set(0, 0, -.13); rightArm.current.rotation.set(0, 0, .13)
      for (const joint of [leftElbow, rightElbow, leftWrist, rightWrist]) joint.current.rotation.set(0, 0, 0)
      eyes.current.scale.y = 1; eyes.current.position.set(0, .64, .36)
      brows.current.position.y = .79
      mouth.current.scale.set(1, 1, 1)
      smoothing.current = { speaking: 0, responding: 0, thinking: 0, listening: 0, mouth: 0 }
    }
    invalidate()
  }, [reducedMotion, isSpeaking, isResponding, isThinking, isListening, invalidate])

  useFrame((_, rawDelta) => {
    if (reducedMotion || paused || document.hidden) return
    const delta = Math.min(rawDelta, .05)
    time.current += delta
    const t = time.current, state = smoothing.current
    state.speaking = MathUtils.damp(state.speaking, isSpeaking ? 1 : 0, 16, delta)
    state.responding = MathUtils.damp(state.responding, isResponding || isSpeaking ? 1 : 0, 12, delta)
    state.thinking = MathUtils.damp(state.thinking, isThinking ? 1 : 0, 12, delta)
    state.listening = MathUtils.damp(state.listening, isListening ? 1 : 0, 14, delta)
    const wavePose = nusaWavePose(t - waveStart.current, !busy.current)
    for (const joint of [rightArm, leftArm, rightElbow, leftElbow, rightWrist, leftWrist]) {
      if (![joint.current.rotation.x, joint.current.rotation.y, joint.current.rotation.z].every(Number.isFinite)) joint.current.rotation.set(0, 0, 0)
    }
    if (t >= gaze.current.next) gaze.current = { next: t + 1.5 + Math.random() * 3.5, x: (Math.random() - .5) * .08, y: (Math.random() - .5) * .035 }
    if ((isSpeaking || isResponding) && t >= gesture.current.next) {
      const duration = 1.1 + Math.random() * .65
      gesture.current = { start: t, duration, next: t + duration + .45 + Math.random() * .8, side: Math.random() < .65 ? 1 : -1 }
    }
    const emphasis = gestureEnvelope(t - gesture.current.start, gesture.current.duration) * state.responding
    const rightGesture = gesture.current.side === 1 ? emphasis : emphasis * .2
    const leftGesture = gesture.current.side === -1 ? emphasis : emphasis * .2
    const breath = Math.sin(t * 1.9)
    const arms = getNusaArmPose({ wavePose, rightGesture, leftGesture, thinking: state.thinking, listening: state.listening, breath })
    body.current.position.y = breath * .009
    body.current.rotation.y = MathUtils.damp(body.current.rotation.y, -.08 + pointer.x * .055 + gaze.current.x * .25, 8, delta)
    body.current.rotation.z = MathUtils.damp(body.current.rotation.z, Math.sin(t * .65) * .006 - emphasis * .008, 8, delta)
    head.current.rotation.x = MathUtils.damp(head.current.rotation.x, -pointer.y * .045 + gaze.current.y + emphasis * .025 - state.listening * .025, 13, delta)
    head.current.rotation.y = MathUtils.damp(head.current.rotation.y, pointer.x * .07 + gaze.current.x + state.thinking * .09, 12, delta)
    head.current.rotation.z = MathUtils.damp(head.current.rotation.z, -.025 - state.thinking * .065 + state.listening * .045 - emphasis * .018, 12, delta)
    rightArm.current.rotation.z = MathUtils.damp(rightArm.current.rotation.z, arms.right.shoulderZ, 14, delta)
    rightArm.current.rotation.x = MathUtils.damp(rightArm.current.rotation.x, arms.right.shoulderX, 14, delta)
    leftArm.current.rotation.z = MathUtils.damp(leftArm.current.rotation.z, arms.left.shoulderZ, 13, delta)
    leftArm.current.rotation.x = MathUtils.damp(leftArm.current.rotation.x, arms.left.shoulderX, 14, delta)
    rightElbow.current.rotation.z = MathUtils.damp(rightElbow.current.rotation.z, arms.right.elbowZ, 15, delta)
    rightElbow.current.rotation.x = MathUtils.damp(rightElbow.current.rotation.x, arms.right.elbowX, 15, delta)
    leftElbow.current.rotation.x = MathUtils.damp(leftElbow.current.rotation.x, arms.left.elbowX, 15, delta)
    rightWrist.current.rotation.z = MathUtils.damp(rightWrist.current.rotation.z, arms.right.wristZ, 16, delta)
    leftWrist.current.rotation.z = MathUtils.damp(leftWrist.current.rotation.z, arms.left.wristZ, 15, delta)
    if (t >= blink.current.next) {
      const double = !blink.current.double && Math.random() < .16
      blink.current = { start: t, next: t + (double ? .29 : 2.6 + Math.random() * 3.4), double }
    }
    const blinkPhase = (t - blink.current.start) / .16
    const closing = blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) ** 2 : 0
    eyes.current.scale.y = Math.max(.06, 1 - closing * .95 + state.listening * .035)
    eyes.current.position.x = MathUtils.damp(eyes.current.position.x, pointer.x * .008 + gaze.current.x * .08, 16, delta)
    eyes.current.position.y = MathUtils.damp(eyes.current.position.y, .64 + pointer.y * .005, 16, delta)
    brows.current.position.y = MathUtils.damp(brows.current.position.y, .79 + state.listening * .025 + state.thinking * .018 + emphasis * .01, 12, delta)
    const energy = isSpeaking ? speechEnergy(speechActivity?.current, performance.now()) : 0
    state.mouth = MathUtils.damp(state.mouth, energy, energy > state.mouth ? 28 : 22, delta)
    mouth.current.scale.y = 1 + state.mouth * 2
    mouth.current.scale.x = 1 - state.mouth * .10
  })

  return <group ref={body} rotation={[0, -.08, 0]}>
    <Box position={[0, -.65, 0]} size={[.84, .36, .53]} radius={.13} color={C.trousers}/>
    {[-1, 1].map(side => <group key={side} position={[side * .235, 0, 0]}>
      <TrouserLeg/>
      <Box position={[0, -2.64, .10]} size={[.36, .31, .59]} radius={.09} color={C.dark}/>
      <Box position={[0, -2.79, .105]} size={[.37, .065, .61]} radius={.025} color={C.sole}/>
      {[-.06, 0, .06].map(y => <Box key={y} position={[0, -2.57 + y, .401]} size={[.18, .013, .018]} radius={.005} color={C.cream}/>)}
    </group>)}
    <Jacket/>
    <Arm side={-1} armRef={leftArm} elbowRef={leftElbow} wristRef={leftWrist}/>
    <Arm side={1} armRef={rightArm} elbowRef={rightElbow} wristRef={rightWrist}/>
    <Limb position={[0, 1.12, .005]} length={.39} radius={.145} color={C.skin}/>
    <group ref={head} position={[0, 1.17, .015]} rotation={[0, 0, -.025]}>
      <Orb position={[0, .56, -.035]} scale={[.44, .575, .385]}/>
      {[-1, 1].map(side => <group key={side}>
        <Orb position={[side * .435, .56, -.005]} scale={[.095, .145, .085]}/>
        <Orb position={[side * .463, .56, .043]} scale={[.04, .087, .025]} color={C.skinShade}/>
      </group>)}
      {/* Hair has a curved hairline, a swept fringe, and a matte silhouette. */}
      <mesh position={[0, .57, -.057]} scale={[.465, .62, .408]} rotation={[0, 0, .025]}><sphereGeometry args={[1, 32, 20, 0, Math.PI * 2, 0, Math.PI * .35]}/><meshStandardMaterial color={C.hair} roughness={.9}/></mesh>
      <Orb position={[-.16, .985, .21]} rotation={[0, 0, -.24]} scale={[.30, .14, .18]} color={C.hair}/>
      <Orb position={[.15, 1.04, .13]} rotation={[0, 0, .25]} scale={[.25, .13, .20]} color={C.hairLight}/>
      <Orb position={[-.36, .77, .10]} rotation={[0, 0, .20]} scale={[.085, .25, .18]} color={C.hair}/>
      <Orb position={[.37, .77, .075]} rotation={[0, 0, -.15]} scale={[.065, .22, .18]} color={C.hair}/>
      <Stroke points={[[-.36, 1.02, .27], [-.18, 1.12, .29], [.02, 1.13, .28], [.23, 1.08, .25]]} radius={.008} color={C.hairLight}/>
      <Orb position={[-.387, .91, .22]} rotation={[0, 0, -.58]} scale={[.035, .085, .016]} color={C.lime}/>
      <group ref={brows} position={[0, .79, .347]}>
        {[-1, 1].map(side => <Stroke key={side} points={[[side * .075, 0, .02], [side * .17, .022, .023], [side * .264, -.006, -.014]]} radius={.018} color={C.hair}/>)}
      </group>
      <group ref={eyes} position={[0, .64, .36]}>
        {[-1, 1].map(side => <group key={side} position={[side * .17, 0, 0]}>
          <Orb scale={[.102, .050, .034]} color="#f9f1df"/>
          <Orb position={[0, 0, .031]} scale={[.039, .043, .019]} color="#53613d"/>
          <Orb position={[0, 0, .047]} scale={[.019, .029, .009]} color="#20281f"/>
          <Orb position={[-.009, .014, .056]} scale={[.009, .010, .005]} color="#fffdf1"/>
          <Stroke points={[[-.094, .006, .008], [0, .048, .022], [.094, .004, .008]]} radius={.008} color={C.hair}/>
        </group>)}
      </group>
      <Orb position={[0, .54, .37]} scale={[.056, .115, .075]} color={C.skinLight}/>
      <Orb position={[0, .46, .423]} scale={[.069, .049, .080]} color={C.skinLight}/>
      {[-1, 1].map(side => <Orb key={side} position={[side * .037, .435, .469]} scale={[.012, .008, .01]} color={C.skinShade}/>)}
      <group ref={mouth} position={[0, .315, .315]}>
        <Orb position={[0, -.002, .013]} scale={[.085, .013, .012]} color="#583b30"/>
        <Orb position={[0, .002, .025]} scale={[.069, .006, .006]} color={C.cream}/>
        <Stroke points={[[-.11, .016, -.002], [-.055, -.009, .017], [0, -.016, .023], [.06, -.009, .017], [.11, .016, -.002]]} radius={.008} color={C.lip}/>
        <Orb position={[0, -.024, .010]} scale={[.068, .009, .012]} color="#d38d75"/>
      </group>
    </group>
  </group>
}

