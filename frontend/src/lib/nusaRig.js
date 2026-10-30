// Shared by the procedural skeleton and the camera projection regression tests.
export const NUSA_RIG = {
  shoulderX: .625, shoulderY: .91, shoulderZ: .015,
  elbowY: -.73, elbowZ: .015, wristY: -.68, wristZ: .035,
  hand: { x: [-.16, .16], y: [-.42, .04], z: [-.08, .10] },
}

export function getNusaArmPose({ wavePose, rightGesture = 0, leftGesture = 0, thinking = 0, listening = 0, breath = 0 }) {
  // Move the wrist along a compact path and solve the two arm bones. Blending
  // shoulder/elbow angles separately swings the hand outside a phone's frame.
  const upper = -NUSA_RIG.elbowY, lower = -NUSA_RIG.wristY
  const restX = Math.sin(.13) * (upper + lower), restY = -Math.cos(.13) * (upper + lower)
  const dx = restX + (.415 - restX) * wavePose.envelope + wavePose.wrist * .045
  const dy = restY + (.21 - restY) * wavePose.envelope
  const elbow = Math.acos(Math.max(-1, Math.min(1, (dx * dx + dy * dy - upper * upper - lower * lower) / (2 * upper * lower))))
  const shoulder = Math.atan2(dx, -dy) - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow))
  return {
    right: {
      shoulderZ: shoulder + rightGesture * .19 + thinking * .22,
      shoulderX: -rightGesture * .20 - thinking * .25 - listening * .035,
      elbowZ: elbow,
      elbowX: -.08 - rightGesture * .8 - thinking * 1.35 - wavePose.envelope * .1,
      wristZ: rightGesture * .12 + wavePose.wrist * .7,
    },
    left: {
      shoulderZ: -.13 - breath * .008 - leftGesture * .20,
      shoulderX: -leftGesture * .18,
      elbowZ: 0, elbowX: -.1 - leftGesture * .8, wristZ: -leftGesture * .13,
    },
  }
}
