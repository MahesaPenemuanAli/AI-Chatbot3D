// Full human silhouette for landing/desktop, and a head-to-knees mobile view.
export const NUSA_FRAME = { width: 3.45, height: 5.85, centerY: -.16, frontZ: 1.2 }
export const NUSA_CONVERSATION_FRAME = { width: 3.05, height: 3.95, centerY: .45, frontZ: .65 }
export const getNusaFrame = framing => framing === 'conversation' ? NUSA_CONVERSATION_FRAME : NUSA_FRAME

export function getNusaCameraDistance(aspect, fov = 33, framing = 'full') {
  const frame = getNusaFrame(framing)
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const halfFov = fov * Math.PI / 360
  const fitHeight = frame.height / (2 * Math.tan(halfFov))
  const fitWidth = frame.width / (2 * Math.tan(halfFov) * safeAspect)
  return Math.max(fitHeight, fitWidth) + frame.frontZ
}
