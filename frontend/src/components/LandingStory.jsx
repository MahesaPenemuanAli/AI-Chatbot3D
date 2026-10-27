import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Compass, Route, Sparkles } from 'lucide-react'

const JourneyScene = lazy(() => import('./JourneyScene'))
const clamp = value => Math.min(1, Math.max(0, value))

function CompassFallback() {
  return <div className="journey-fallback" aria-hidden="true"><span/><Compass size={125} strokeWidth={.65}/><i/></div>
}

export default function LandingStory({ openChat }) {
  const storyRef = useRef(null)
  const progressRef = useRef(0)
  const [active, setActive] = useState(() => !document.hidden)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const root = storyRef.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canObserve = 'IntersectionObserver' in window
    let frame = 0
    let inView = true
    const update = () => {
      frame = 0
      const rect = root.getBoundingClientRect()
      if (!canObserve) {
        inView = rect.bottom > 0 && rect.top < window.innerHeight
        setActive(inView && !document.hidden)
      }
      const value = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight))
      progressRef.current = value
      root.style.setProperty('--story-progress', value)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const visibility = () => setActive(inView && !document.hidden)
    const motion = () => setReducedMotion(media.matches)
    const observer = canObserve ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      visibility()
      schedule()
    }) : null
    observer?.observe(root)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('visibilitychange', visibility)
    media.addEventListener('change', motion)
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', visibility)
      media.removeEventListener('change', motion)
    }
  }, [])

  return <section className="journey-story" ref={storyRef} aria-label="Perjalanan bersama Nusa">
    <div className="journey-sticky" aria-hidden="true">
      <div className="journey-edge-light"/>
      <div className="journey-scene"><Suspense fallback={<CompassFallback/>}><JourneyScene progressRef={progressRef} active={active} reducedMotion={reducedMotion}/></Suspense></div>
      <div className="journey-guide"><span>RASA INGIN TAHU ADALAH KOMPASMU</span><i><b/></i><span>INDONESIA · NUSA AI</span></div>
    </div>
    <div className="journey-chapters">
      <section className="journey-chapter journey-opening" id="beranda">
        <div className="opening-copy"><div className="eyebrow"><span/> YOUR CURIOSITY. A NEW DIRECTION.</div><h1>Rasa ingin<br/><em>tahu.</em></h1><p>Membawamu ke tempat baru.<br/>Nusa, teman AI 3D untuk setiap perjalananmu.</p><button className="button button-lime" onClick={() => openChat()}>Mulai cerita <ArrowUpRight size={18}/></button><span className="opening-note">Coba demo tanpa akun.</span></div>
        <a className="journey-scroll" href="#rencana"><ArrowDown size={17}/><span>GULIR. TEMUKAN ARAHMU.</span></a>
        <span className="chapter-index">01 — 03</span>
      </section>
      <section className="journey-chapter journey-planning" id="rencana">
        <div className="planning-copy"><div className="eyebrow">01 / DARI IDE KE ITINERARY</div><h2>Ikuti rasa.<br/>Temukan <em>arah.</em></h2><p>Rencana yang terasa seperti kamu. Ceritakan minatmu, waktu yang kamu punya, dan suasana yang kamu cari. Kita rangkai sisanya bersama.</p><ul className="planning-points"><li><Route size={16}/><span>Rute sesuai ritmemu</span></li><li><Compass size={16}/><span>Destinasi & kuliner lokal</span></li><li><Sparkles size={16}/><span>Ide dari satu percakapan</span></li></ul><button className="text-button" onClick={() => openChat('Bantu aku merencanakan perjalanan di Indonesia sesuai minat dan waktuku.')}>Rangkai rencanamu <ArrowUpRight size={19}/></button></div>
        <span className="chapter-index">02 — 03</span>
      </section>
      <section className="journey-chapter journey-discovery">
        <div className="discovery-heading"><div className="eyebrow">02 / ADA DUNIA DI DEKATMU</div><h2>Indonesia,<br/><em>lebih dekat.</em></h2></div>
        <div className="discovery-foot"><p>Dari langkah kecil sampai perjalanan besar.<br/>Selalu ada cerita yang belum kamu temukan.</p><a className="text-button" href="#destinasi">Jelajahi tempatnya <ArrowDown size={18}/></a></div>
        <span className="chapter-index">03 — 03</span>
      </section>
    </div>
  </section>
}
