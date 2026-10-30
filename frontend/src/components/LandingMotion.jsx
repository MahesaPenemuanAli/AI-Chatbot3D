import { lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Compass, Globe2, MessageCircle, Pause, Play, Rotate3D, Route } from 'lucide-react'
import { MotionContext } from './landingMotionContext'
import { storyProgress } from '../lib/motionMath'

const LandingRenderer = lazy(() => import('./LandingRenderer'))
const clamp = value => Math.min(1, Math.max(0, value))
const stageIcons = { conversation: MessageCircle, map: Route, questions: Compass, departure: Globe2 }

function readProgress(view) {
  const track = view.track.current
  if (!track) return .35
  const owner = track.closest('[data-scroll-story]') || track.closest('section') || track
  const rect = owner.getBoundingClientRect()
  if (view.progressMode === 'story') {
    const anchors = [...owner.querySelectorAll('[data-expedition-chapter]')].map(chapter => chapter.offsetTop)
    return storyProgress(-rect.top, anchors)
  }
  return clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height))
}

export function LandingMotion({ children }) {
  const [views, setViews] = useState([])
  const [renderer, setRenderer] = useState('waiting')
  const [loaded, setLoaded] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const redraw = useRef(null)
  const registry = useRef(new Map())
  const register = useCallback(view => {
    if (view.track.current) {
      view.progressRef.current = readProgress(view)
    }
    registry.current.set(view.id, view)
    setViews([...registry.current.values()])
    if (view.active) setLoaded(true)
    redraw.current?.()
  }, [])
  const unregister = useCallback(id => {
    registry.current.delete(id)
    setViews([...registry.current.values()])
    redraw.current?.()
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const update = () => {
      frame = 0
      registry.current.forEach(view => {
        if (!view.active || !view.track.current) return
        view.progressRef.current = readProgress(view)
      })
      // Scroll only updates refs. Scene easing happens on the render clock,
      // avoiding DOM style writes and forced layouts while scrolling.
      redraw.current?.()
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const visibility = () => { setPageVisible(!document.hidden); schedule() }
    const motion = () => { setReducedMotion(media.matches); schedule() }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('visibilitychange', visibility)
    media.addEventListener('change', motion)
    update()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', visibility)
      media.removeEventListener('change', motion)
    }
  }, [])
  useEffect(() => { redraw.current?.() }, [views, pageVisible, reducedMotion])
  const context = useMemo(() => ({ register, unregister, renderer, redraw, reducedMotion, paused, setPaused }), [register, unregister, renderer, reducedMotion, paused])
  return <MotionContext.Provider value={context}>{children}{loaded && <Suspense fallback={null}><LandingRenderer views={views} pageVisible={pageVisible} reducedMotion={reducedMotion} paused={paused} redraw={redraw} onStatus={setRenderer}/></Suspense>}</MotionContext.Provider>
}

export function SceneStage({ kind, className = '', label, caption, interaction = 0, progressMode = 'section' }) {
  const motion = useContext(MotionContext)
  const id = useId()
  const track = useRef(null)
  const progressRef = useRef(.35)
  const pointerRef = useRef({ x: 0, y: 0 })
  const spinRef = useRef(0)
  const [active, setActive] = useState(false)
  const Icon = stageIcons[kind] || Compass
  const { register, unregister, redraw } = motion
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setActive(true); return }
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: progressMode === 'story' ? '400px' : '60px' })
    observer.observe(track.current)
    return () => observer.disconnect()
  }, [progressMode])
  useEffect(() => { register({ id, kind, track, progressRef, pointerRef, spinRef, active, interaction, progressMode }) }, [register, id, kind, active, interaction, progressMode])
  useEffect(() => () => unregister(id), [unregister, id])
  const move = event => {
    if (motion.reducedMotion || motion.paused) return
    const rect = event.currentTarget.getBoundingClientRect()
    pointerRef.current.x = clamp((event.clientX - rect.left) / rect.width) * 2 - 1
    pointerRef.current.y = 1 - clamp((event.clientY - rect.top) / rect.height) * 2
  }
  return <figure className={`landing-scene-stage landing-scene-${kind} ${className}`} data-scene-kind={kind} data-renderer={motion.renderer} onPointerMove={move} onPointerLeave={() => { pointerRef.current.x = 0; pointerRef.current.y = 0 }}>
    <div className="landing-scene-window" ref={track} role="img" aria-label={`${label}${motion.renderer === 'ready' ? '. Visualisasi 3D aktif.' : motion.renderer === 'fallback' ? '. Ilustrasi diam; 3D tidak tersedia di browser ini.' : ''}`}>
      <div className="landing-scene-fallback" aria-hidden="true"><span/><Icon size={96} strokeWidth={.7}/><i/></div>
    </div>
    <figcaption><span><i/>{caption || 'GULIR UNTUK MENJELAJAH'}</span><div><button type="button" aria-label={`Jelajahi objek 3D: ${label}`} onClick={() => { spinRef.current += 1; redraw.current?.() }} disabled={motion.reducedMotion || motion.paused || motion.renderer !== 'ready'}><Rotate3D size={15}/><span>Jelajahi</span></button><button type="button" aria-label={motion.paused ? 'Lanjutkan animasi 3D halaman' : 'Jeda animasi 3D halaman'} aria-pressed={motion.paused} onClick={() => motion.setPaused(value => !value)} disabled={motion.reducedMotion || motion.renderer !== 'ready'}>{motion.paused ? <Play size={13}/> : <Pause size={13}/>}</button></div></figcaption>
  </figure>
}
