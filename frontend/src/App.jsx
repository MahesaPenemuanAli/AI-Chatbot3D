import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, AudioLines, ChevronDown, Compass, Globe2, Menu, MessageCircle, Navigation, Sparkles, Volume2, X } from 'lucide-react'
import LandingStory from './components/LandingStory'
import DestinationGallery from './components/DestinationGallery'
import CompanionIntro from './components/CompanionIntro'
import LandingFilm from './components/LandingFilm'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

const ChatWorkspace = lazy(() => import('./components/ChatWorkspace'))
const questions = [
  { q: 'Nusa AI itu apa, sih?', a: 'Nusa AI adalah teman perjalanan virtual dengan avatar anime 3D. Kamu bisa bertukar ide destinasi, menyusun rute, dan menemukan inspirasi wisata Indonesia melalui percakapan yang santai.' },
  { q: 'Bisa langsung dicoba tanpa akun?', a: 'Bisa. Mode demo tersedia tanpa akun dan menggunakan contoh jawaban lokal untuk mengenalkan pengalaman Nusa. Untuk jawaban AI langsung, masuk ke akun dengan layanan backend dan penyedia AI yang sudah dikonfigurasi.' },
  { q: 'Apakah Nusa bisa diajak bicara?', a: 'Pada browser yang mendukung pengenalan suara, kamu bisa menggunakan tombol mikrofon untuk mengubah ucapan menjadi pesan. Nusa juga dapat membacakan jawaban menggunakan suara yang tersedia di perangkatmu.' },
  { q: 'Bisa memesan hotel atau tiket di sini?', a: 'Nusa membantu merencanakan perjalanan. Pemesanan hotel, transportasi, dan tiket dilakukan melalui penyedia pilihanmu. Periksa kembali harga, jam buka, dan kondisi destinasi sebelum berangkat.' },
]

function Brand() {
  return <a className="brand" href="#" aria-label="Nusa AI — halaman utama"><span className="brand-symbol"><Sparkles size={19} strokeWidth={1.6}/></span><span>nusa<span className="brand-ai">ai</span><span className="brand-dot">.</span></span></a>
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
  return <main className="page-recovery" role="alert"><Sparkles size={36}/><h1>Halaman belum bisa dimuat.</h1><p>Periksa koneksi, lalu coba muat ulang untuk melanjutkan.</p><div><button className="button button-dark" onClick={() => window.location.reload()}>Muat ulang</button><button className="button" onClick={onBack}>Kembali ke beranda</button></div></main>
}

function LandingPage({ openChat }) {
  const menuButtonRef = useRef(null)
  const mainRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(0)
  const [demoInput, setDemoInput] = useState('')
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

  return <div className="landing-page">
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
      <section className="conversation-section" id="obrolan"><div className="section-container conversation-inner">
        <div className="conversation-copy" data-reveal><div className="eyebrow">05 / IDE BESAR, OBROLAN KECIL</div><h2>Mulai<br/>sesantai <em>itu.</em></h2><p>“Aku butuh liburan.” Kadang, sebuah cerita baru dimulai dari empat kata. Kamu membawa rasa penasaran, Nusa membantu merangkainya.</p><div className="conversation-features"><span><MessageCircle size={16}/> Bahasa sehari-hari</span><span><AudioLines size={16}/> Suara & ekspresi</span></div><button className="text-button" onClick={() => startChat()}>Yuk, ngobrol <ArrowUpRight size={18}/></button></div>
        <div className="meet-demo" data-reveal><div className="demo-topbar"><span className="demo-brand"><Sparkles size={16}/> nusa ai</span><span>CONTOH PERCAKAPAN</span></div><div className="demo-message demo-message-user">Aku butuh liburan, tapi bingung ke mana.</div><div className="demo-message-row"><span className="demo-avatar"><Sparkles size={17}/></span><div className="demo-message demo-message-nusa">Mulai dari yang kamu suka, yuk.<br/>Tim suara ombak atau udara pegunungan?<span className="message-time">Jawaban contoh lokal</span></div></div><div className="demo-options"><button onClick={() => startChat('Aku ingin liburan ke pantai yang tenang di Indonesia. Ada rekomendasi?')}>Suara ombak <ArrowUpRight size={12}/></button><button onClick={() => startChat('Aku ingin liburan ke pegunungan di Indonesia. Ada rekomendasi?')}>Udara pegunungan <ArrowUpRight size={12}/></button></div><form className="demo-composer" onSubmit={event => { event.preventDefault(); startChat(demoInput.trim() || undefined) }}><input aria-label="Tulis ide perjalanan untuk Nusa" placeholder="Ceritakan liburan impianmu…" value={demoInput} onChange={event => setDemoInput(event.target.value)} maxLength={2000}/><button type="submit" aria-label="Mulai percakapan"><ArrowUpRight size={18}/></button></form><span className="demo-caption"><Volume2 size={12}/> Satu percakapan. Banyak kemungkinan.</span></div>
      </div></section>
      <section className="how-section section-container" id="cara-kerja"><div className="how-heading" data-reveal><div className="eyebrow">06 / DARI PIKIRAN KE PERJALANAN</div><h2>Sesederhana<br/><em>mengikuti rasa.</em></h2></div><div className="steps-grid">{[{ number: '01', icon: MessageCircle, title: 'Ceritakan keinginanmu.', description: 'Tujuan, durasi, atau suasana yang kamu cari. Mulai sesantai itu.' }, { number: '02', icon: Compass, title: 'Temukan kemungkinan.', description: 'Jelajahi destinasi, kuliner lokal, dan rute bersama Nusa.' }, { number: '03', icon: Navigation, title: 'Bawa ceritamu pergi.', description: 'Rapikan rencana, cek detail perjalanan, lalu berangkat dengan caramu.' }].map(step => <div className="step" key={step.number} data-reveal><div className="step-top"><span>{step.number}</span><step.icon size={22} strokeWidth={1.3}/></div><h3>{step.title}</h3><p>{step.description}</p></div>)}</div></section>
      <section className="faq-section section-container"><div data-reveal><div className="eyebrow">SEBELUM KITA BERANGKAT</div><h2>Masih<br/><em>penasaran?</em></h2><button className="text-button" onClick={() => startChat()}>Tanya Nusa <ArrowUpRight size={17}/></button></div><div className="faq-list">{questions.map((item, index) => <div className={faqOpen === index ? 'faq-item expanded' : 'faq-item'} key={item.q}><h3><button aria-expanded={faqOpen === index} aria-controls={'faq-' + index} onClick={() => setFaqOpen(faqOpen === index ? null : index)}>{item.q}<ChevronDown size={18}/></button></h3><div className="faq-answer" id={'faq-' + index} hidden={faqOpen !== index}><p>{item.a}</p></div></div>)}</div></section>
      <section className="closing-section"><div className="section-container"><div className="eyebrow">PERJALANAN BERIKUTNYA DIMULAI DI SINI.</div><h2>Ke mana<br/><em>kita hari ini?</em></h2><button className="button button-lime" onClick={() => startChat()}>Temui Nusa <ArrowUpRight size={20}/></button><span className="closing-coordinate">MULAI DENGAN SATU “HAI”.</span></div><span className="closing-orbit" aria-hidden="true"/></section>
    </main>
    <footer className="site-footer section-container"><div className="footer-main"><Brand/><p>Rasa penasaran adalah kompasmu.</p><a href="#beranda" className="back-top">Kembali ke atas <ArrowRight size={15}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Nusa AI.</span><span>Dibuat untuk setiap rasa ingin tahu. <Globe2 size={12}/></span></div></footer>
  </div>
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
  return page === 'chat' ? <Suspense fallback={<div className="app-loading"><Sparkles size={30}/><p>Nusa sedang bersiap…</p></div>}><ErrorBoundary fallback={<PageRecovery onBack={backHome}/>}><ChatPage onBack={backHome} initialPrompt={initialPrompt}/></ErrorBoundary></Suspense> : <LandingPage openChat={openChat}/>
}
