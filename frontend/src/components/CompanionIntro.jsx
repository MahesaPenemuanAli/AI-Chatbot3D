import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, AudioLines, Sparkles } from 'lucide-react'
import ErrorBoundary from './ErrorBoundary'

const AvatarCanvas = lazy(() => import('./AvatarCanvas'))

export default function CompanionIntro({ openChat }) {
  const stageRef = useRef(null)
  const [seen, setSeen] = useState(false)
  const [greeting, setGreeting] = useState(0)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect() }
    }, { rootMargin: '300px' })
    if (stageRef.current) observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])
  const poster = <div className="companion-poster"><img src="/models/.candidate-darkness/preview.png" loading="lazy" alt="Potret Nusa, karakter anime perempuan"/><span><Sparkles size={12}/> Menyiapkan Nusa…</span></div>

  return <section className="companion-intro" id="kenalan"><div className="section-container companion-intro-inner">
    <div className="companion-intro-stage" ref={stageRef}><div className="companion-halo"/><span className="companion-stage-label">NUSA / YOUR TRAVEL COMPANION</span><div className="companion-intro-avatar"><ErrorBoundary fallback={<div className="companion-poster"><img src="/models/.candidate-darkness/preview.png" loading="lazy" alt="Potret Nusa, karakter anime perempuan"/><span><Sparkles size={12}/> Nusa tetap bisa menemanimu lewat chat.</span></div>}>{seen ? <Suspense fallback={poster}><AvatarCanvas greeting={greeting}/></Suspense> : poster}</ErrorBoundary></div><button className="companion-wave" aria-label="Sapa Nusa" onClick={() => setGreeting(value => value + 1)}>Sapa Nusa <span aria-hidden="true">👋</span></button><span className="companion-stage-coordinate">NUSA AI · TEMAN JELAJAHMU</span></div>
    <div className="companion-intro-copy" data-reveal><div className="eyebrow">04 / ADA TEMAN DI SANA</div><h2>Lebih dari<br/>sebuah <em>jawaban.</em></h2><p>Hai, aku Nusa. Teman anime 3D yang mendengarkan idemu, ikut penasaran, dan membantumu menemukan sisi lain Indonesia.</p><div className="companion-expression"><AudioLines size={19}/><span>Gerakan, suara, dan ekspresi.<br/>Percakapan yang terasa lebih dekat.</span></div><button className="button button-forest" onClick={() => openChat()}>Kenalan lewat obrolan <ArrowUpRight size={18}/></button><span className="companion-small-note">Mulai dari satu “hai”.</span></div>
  </div></section>
}
