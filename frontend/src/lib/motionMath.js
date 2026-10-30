// Exponential easing keeps the same response time at 30, 60, and 120 Hz.
export function dampValue(current, target, rate, delta) {
  return target + (current - target) * Math.exp(-rate * Math.max(0, delta))
}

// A calm look to either side returns exactly to the front, with no abrupt
// start/stop or high-speed full revolution exposing the backs of the objects.
export function inspectionAngle(elapsed, duration = 2.8) {
  const progress = Math.max(0, Math.min(1, elapsed / duration))
  if (progress === 0 || progress === 1) return 0
  return .65 * Math.sin(progress * Math.PI * 2) * Math.sin(progress * Math.PI) ** 2
}

// Unequal mobile chapter heights still reach the exact authored camera pose
// when each chapter reaches the top of the viewport.
export function storyProgress(position, anchors) {
  if (anchors.length < 2) return 0
  if (position <= anchors[0]) return 0
  for (let index = 0; index < anchors.length - 1; index += 1) {
    if (position < anchors[index + 1]) {
      const span = Math.max(1, anchors[index + 1] - anchors[index])
      return (index + (position - anchors[index]) / span) / (anchors.length - 1)
    }
  }
  return 1
}
