import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

export default function LandingFilm() {
  const videoRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const [manuallyPaused, setManuallyPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReducedMotion(media.matches)
    const onVisibility = () => setPageVisible(!document.hidden)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.02 })
    if (videoRef.current) observer.observe(videoRef.current)
    media.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (reducedMotion || !inView || !pageVisible || manuallyPaused || failed) video.pause()
    else if (ready) video.play().catch(() => { /* A click can resume when autoplay is unavailable. */ })
  }, [reducedMotion, inView, pageVisible, manuallyPaused, ready, failed])

  function togglePlayback() {
    const video = videoRef.current
    if (!video || reducedMotion) return
    if (video.paused) {
      setManuallyPaused(false)
      // Visibility changes can interrupt a pending play request. Only an
      // explicit pause click should change the user's playback preference.
      video.play().catch(() => {})
    } else {
      setManuallyPaused(true)
      video.pause()
    }
  }

  return <>
    <div className="landing-film" aria-hidden="true">
      <img className="landing-film-poster" src="/images/padar.jpg" alt="" fetchPriority="high" />
      <video ref={videoRef} className={ready && !failed ? 'landing-film-video is-ready' : 'landing-film-video'}
        autoPlay={!reducedMotion} muted loop playsInline preload={reducedMotion ? 'none' : 'metadata'}
        poster="/images/padar.jpg" onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}>
        <source src="/videos/nusa-landscape.mp4" type="video/mp4" onError={() => setFailed(true)} />
      </video>
      <div className="landing-film-shade" />
    </div>
    <div className="film-caption"><span><i /> PULAU PADAR, INDONESIA</span>
      {!failed && <button type="button" className="film-playback" onClick={togglePlayback} disabled={reducedMotion || !ready}
        aria-label={reducedMotion ? 'Video dijeda mengikuti pengaturan kurangi gerakan' : playing ? 'Jeda video latar' : 'Putar video latar'}
        aria-pressed={playing}>
        {playing ? <Pause size={13} /> : <Play size={13} />}<span>{reducedMotion ? 'Gerakan dikurangi' : playing ? 'Jeda video' : 'Putar video'}</span>
      </button>}
    </div>
  </>
}
