import { gestureEnvelope } from './nusaMotion.js'

const fingers = ['Index', 'Middle', 'Ring', 'Little']
export const ANIME_BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', ...['left', 'right'].flatMap(side => ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', ...fingers.flatMap(finger => ['Proximal', 'Intermediate', 'Distal'].map(joint => finger + joint)), 'ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'].map(part => side + part))]
const unit = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0

// Asymmetrical movement in the VRM normalized humanoid coordinate system.
export function getAnimePose(time, state = {}) {
  const t = Number.isFinite(time) ? time : 0
  const speaking = unit(state.speaking), thinking = unit(state.thinking), listening = unit(state.listening)
  const talking = Math.max(speaking, unit(state.responding) * .5)
  const wave = gestureEnvelope(state.waveElapsed, 3.2)
  const flutter = wave ? Math.sin(state.waveElapsed * 11) : 0
  const breath = Math.sin(t * 1.8)
  const sway = Math.sin(t * .72)
  const explain = talking * (.5 + .5 * Math.sin(t * 2.3))
  const idle = gestureEnvelope(t % 15 - 8, 4.2)
  // Bring the wrist up alongside the face instead of sweeping a straight arm
  // through the edge of a portrait viewport. The elbow folds ahead of the lift.
  const wristX = .25 + wave * .1 + Math.sin(wave * Math.PI) * .42
  const wristY = -1.45 + wave * 1.8
  const upperLength = .78, lowerLength = .76
  const distance = Math.min(upperLength + lowerLength - .001, Math.hypot(wristX, wristY))
  const elbow = Math.acos(Math.max(-1, Math.min(1, (distance ** 2 - upperLength ** 2 - lowerLength ** 2) / (2 * upperLength * lowerLength))))
  const shoulder = -Math.atan2(wristY, wristX) + Math.acos(Math.max(-1, Math.min(1, (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance))))
  const pose = {
    hips: [0, sway * .028, sway * .023],
    spine: [breath * .012 - listening * .035, Math.sin(t * .65) * .025, -sway * .025],
    chest: [breath * .012, Math.sin(t * .85) * .02 + explain * .035, Math.sin(t * .9 + .6) * .015],
    upperChest: [0, 0, 0],
    neck: [-listening * .035, 0, thinking * .025],
    head: [-unit(state.gazeY) * .09 + Math.sin(t * 4) * speaking * .018 - listening * .045, unit(state.gazeX) * .16 + Math.sin(t * .55) * .035, Math.sin(t * .8 + .7) * .025 + thinking * .1 + listening * .06],
    leftShoulder: [0, 0, Math.sin(t * 1.8 + .3) * .009],
    rightShoulder: [0, 0, -Math.sin(t * 1.8) * .009],
    leftUpperArm: [-.08 - explain * .22 - thinking * .13, -.04, 1.32 + explain * .1 - idle * .12],
    leftLowerArm: [-.12 - explain * .22, -.03, -.17 - explain * .6 - thinking * .24 - idle * .32],
    leftHand: [.05 + explain * .14, .08, -.05 - explain * .12],
    rightUpperArm: [-.07 - wave * .12 - idle * .12, .02, -1.3 - wave * (shoulder - 1.3) + thinking * .15],
    rightLowerArm: [-.1 - wave * .1, .02, .19 + wave * (elbow - .19) + thinking * .3],
    rightHand: [.06 + wave * flutter * .13, -.08 + wave * .25, .06 + wave * flutter * .22],
    leftUpperLeg: [.01, .01, -.025 + sway * .012],
    rightUpperLeg: [-.015, -.01, .025 + sway * .012],
    leftLowerLeg: [.018, 0, 0], rightLowerLeg: [.025, 0, 0],
  }
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const open = side === 'right' ? wave : explain
    fingers.forEach((finger, i) => {
      const curl = (.1 + i * .024) * (1 - open * .85)
      pose[`${side}${finger}Proximal`] = [0, 0, sign * curl]
      pose[`${side}${finger}Intermediate`] = [0, 0, sign * curl * .7]
      pose[`${side}${finger}Distal`] = [0, 0, sign * curl * .4]
    })
    pose[`${side}ThumbMetacarpal`] = [-.12, sign * .1, sign * .05]
    pose[`${side}ThumbProximal`] = [0, 0, sign * .08]
    pose[`${side}ThumbDistal`] = [0, 0, sign * .06]
  }
  // VRM 1 faces +Z: the anatomical left arm extends toward -X in rest pose.
  // Positive left-arm Z would lift the arm above the head instead of relaxing it.
  for (const name of ANIME_BONES) {
    if (/^(left|right)(Shoulder|UpperArm|LowerArm|Hand|Index|Middle|Ring|Little|Thumb)/.test(name) && pose[name]) pose[name][2] *= -1
  }
  return pose
}
