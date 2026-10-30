import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Globe2, Menu, X } from 'lucide-react'
import NusaMark from './components/NusaMark'
import LandingStory from './components/LandingStory'
import DestinationGallery from './components/DestinationGallery'
import CompanionIntro from './components/CompanionIntro'
import LandingFilm from './components/LandingFilm'
import ExpeditionStory from './components/ExpeditionStory'
import { LandingMotion } from './components/LandingMotion'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'
import './components/LandingDetails.css'
import './components/ExpeditionStory.css'

const ChatWorkspace = lazy(() => import('./components/ChatWorkspace'))

function Brand() {
  return <a className="brand" href="#" aria-label="Nusa AI — halaman utama"><span className="brand-symbol"><NusaMark size={25}/></span><span>nusa<span className="brand-ai">ai</span><span className="brand-dot">.</span></span></a>
}

function ChatPage(props) {
  useEffect(() => {
    const main = document.querySelector('.chat-main')
    main?.setAttribute('tabindex', '-1')
    main?.focus({ preventScroll: true })
  }, [])
  return <ChatWorkspace {...props} />
}

function PageRecovery({ onBack }) {
  return <main className="page-recovery" role="alert"><NusaMark size={36}/><h1>Halaman belum bisa dimuat.</h1><p>Periksa koneksi, lalu coba muat ulang untuk melanjutkan.</p><div><button className="button button-dark" onClick={() => window.location.reload()}>Muat ulang</button><button className="button" onClick={onBack}>Kembali ke beranda</button></div></main>
}

function LandingPage({ openChat }) {
  const menuButtonRef = useRef(null)
  const mainRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) }
    }), { threshold: .08 })
    document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = event => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])
  const startChat = prompt => { setMenuOpen(false); openChat(prompt) }

  return <LandingMotion><div className="landing-page">
    <a className="skip-link" href="#konten">Langsung ke konten</a>
    <header className="story-header"><div className="nav-container"><Brand/>
      <nav id="nusa-navigation" aria-label="Navigasi utama" className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
        <a href="#rencana" onClick={() => setMenuOpen(false)}>Pengalaman</a><a href="#destinasi" onClick={() => setMenuOpen(false)}>Destinasi</a><a href="#kenalan" onClick={() => setMenuOpen(false)}>Temui Nusa</a>
      </nav>
      <div className="nav-actions"><span className="language"><Globe2 size={13}/> ID</span><button className="nav-cta" onClick={() => startChat()}>Mulai ngobrol <ArrowUpRight size={14}/></button><button ref={menuButtonRef} className="mobile-menu" aria-controls="nusa-navigation" aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button></div>
    </div></header>
    <main ref={mainRef} id="konten" tabIndex={-1}>
      <LandingStory openChat={startChat}/>
      <DestinationGallery openChat={startChat}/>
      <section className="scenic-section section-container" aria-label="Inspirasi perjalanan ke Pulau Padar"><div className="scenic-frame"><LandingFilm/><div className="scenic-copy"><div className="eyebrow">JEDA SEJENAK. LIHAT LEBIH DEKAT.</div><h2>Selalu ada<br/>sisi <em>lain.</em></h2><button className="text-button" onClick={() => startChat('Aku ingin menjelajahi Labuan Bajo dan Pulau Padar. Bantu aku merencanakan perjalanannya.')}>Temukan Labuan Bajo <ArrowUpRight size={19}/></button></div></div></section>
      <CompanionIntro openChat={startChat}/>
      <ExpeditionStory openChat={startChat}/>
    </main>
    <footer className="site-footer section-container"><div className="footer-main"><Brand/><p>Rasa penasaran adalah kompasmu.</p><nav className="footer-nav" aria-label="Navigasi footer"><a href="#destinasi">Destinasi</a><a href="#kenalan">Temui Nusa</a><a href="#pertanyaan">FAQ</a></nav><a href="#beranda" className="back-top">Kembali ke atas <ArrowRight size={15}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Nusa AI.</span><span>Dibuat untuk setiap rasa ingin tahu. <Globe2 size={12}/></span></div></footer>
  </div></LandingMotion>
}

export default function App() {
  const [page, setPage] = useState(() => window.location.hash.startsWith('#chat') ? 'chat' : 'home')
  const [initialPrompt, setInitialPrompt] = useState('')
  useEffect(() => {
    const handleHash = () => { const isChat = window.location.hash.startsWith('#chat'); if (!isChat) setInitialPrompt(''); setPage(isChat ? 'chat' : 'home') }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])
  useEffect(() => { document.title = page === 'chat' ? 'Ngobrol dengan Nusa — Nusa AI' : 'Nusa AI — Teman untuk setiap petualangan'; window.scrollTo(0, 0) }, [page])
  const openChat = (prompt = '') => { setInitialPrompt(prompt); setPage('chat'); window.location.hash = 'chat' }
  const backHome = () => { setInitialPrompt(''); setPage('home'); window.location.hash = ''; window.scrollTo(0, 0) }
  return page === 'chat' ? <Suspense fallback={<div className="app-loading"><NusaMark size={30}/><p>Nusa sedang bersiap…</p></div>}><ErrorBoundary fallback={<PageRecovery onBack={backHome}/>}><ChatPage onBack={backHome} initialPrompt={initialPrompt}/></ErrorBoundary></Suspense> : <LandingPage openChat={openChat}/>
}
