import { createContext, useContext } from 'react'

export const MotionContext = createContext(null)

export function useLandingAnimationPaused() {
  return useContext(MotionContext)?.paused || false
}
