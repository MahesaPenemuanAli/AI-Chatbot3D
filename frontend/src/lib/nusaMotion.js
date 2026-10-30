const clamp = value => Math.max(0, Math.min(1, value))

// Soft anticipation and follow-through for a single, occasional gesture.
export function gestureEnvelope(elapsed, duration) {
  if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || elapsed <= 0 || elapsed >= duration || duration <= 0) return 0
  return Math.sin(Math.PI * elapsed / duration) ** 2
}

// A canceled greeting uses an infinite elapsed time. Never evaluate its sine:
// even a zero envelope multiplied by sin(Infinity) poisons a joint with NaN.
export function nusaWavePose(elapsed, enabled = true) {
  const envelope = enabled ? gestureEnvelope(elapsed, 1.9) : 0
  if (!envelope) return { envelope: 0, lift: 0, wrist: 0 }
  const oscillation = Math.sin(elapsed * 14)
  return { envelope, lift: envelope * (1.55 + oscillation * .12), wrist: envelope * oscillation * .32 }
}

// Speech boundaries describe words, not phonemes. Use them as an expressive
// mouth envelope; browsers without boundaries receive a gentle approximation.
export function speechEnergy(activity, now) {
  if (!activity?.active) return 0
  const elapsed = Math.max(0, now - activity.startedAt) / 1000
  if (activity.boundarySupported) {
    const age = Math.max(0, now - activity.boundaryAt)
    const pulse = Math.max(0, 1 - age / 220)
    return clamp(pulse * (.6 + .4 * Math.sin(age * .038) ** 2))
  }
  return clamp((.22 + .68 * Math.sin(elapsed * 14) ** 2) * (.7 + .3 * Math.sin(elapsed * 3.6) ** 2))
}
