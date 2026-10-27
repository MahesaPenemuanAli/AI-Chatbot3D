import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, ChevronDown, Compass, Globe2, MapPin, Menu, MessageCircle, Navigation, Sparkles, Volume2, X } from 'lucide-react'
const AvatarCanvas = lazy(() => import('./components/AvatarCanvas'))
import './App.css'
import LandingFilm from './components/LandingFilm'
import ErrorBoundary from './components/ErrorBoundary'

const ChatWorkspace = lazy(() => import('./components/ChatWorkspace'))

const destinations = [
  { name: 'Bali', region: 'Bali & Nusa Tenggara', caption: 'Sedikit ombak. Banyak cerita.', image: '/images/bali.jpg', alt: 'Pura di tepi danau dengan pegunungan hijau di Bali', tag: 'Alam & ketenangan', prompt: 'Bantu aku menyusun itinerary santai 3 hari di Bali.' },
  { name: 'Yogyakarta', region: 'Jawa', caption: 'Setiap sudut punya kisah.', image: '/images/borobudur.jpg', alt: 'Stupa Candi Borobudur dengan panorama pegunungan Jawa', tag: 'Budaya & kuliner', prompt: 'Aku ingin menjelajahi budaya dan kuliner Yogyakarta selama 3 hari.' },
  { name: 'Labuan Bajo', region: 'Bali & Nusa Tenggara', caption: 'Petualangan di ujung cakrawala.', image: '/images/padar.jpg', alt: 'Perbukitan Pulau Padar mengelilingi teluk biru di Labuan Bajo', tag: 'Laut & petualangan', prompt: 'Buatkan ide perjalanan 3 hari ke Labuan Bajo dan Pulau Padar.' },
]

const questions = [
  { q: 'Nusa AI itu apa, sih?', a: 'Nusa AI adalah teman perjalanan virtual dengan avatar 3D. Kamu bisa bertukar ide destinasi, menyusun rute, dan menemukan inspirasi wisata Indonesia melalui percakapan yang santai.' },
  { q: 'Bisa langsung dicoba tanpa akun?', a: 'Bisa. Mode demo tersedia tanpa akun dan menggunakan contoh jawaban lokal untuk mengenalkan pengalaman Nusa. Untuk jawaban AI langsung, masuk ke akun dengan layanan backend dan penyedia AI yang sudah dikonfigurasi.' },
  { q: 'Apakah Nusa bisa diajak bicara?', a: 'Pada browser yang mendukung pengenalan suara, kamu bisa menggunakan tombol mikrofon untuk mengubah ucapan menjadi pesan. Nusa juga dapat membacakan jawaban menggunakan suara yang tersedia di perangkatmu.' },
  { q: 'Bisa memesan hotel atau tiket di sini?', a: 'Nusa membantu merencanakan perjalanan. Pemesanan hotel, transportasi, dan tiket dilakukan melalui penyedia pilihanmu. Periksa kembali harga, jam buka, dan kondisi destinasi sebelum berangkat.' },
]

function Brand() {
  return <a className="brand" href="#" aria-label="Nusa AI — halaman utama"><span className="brand-symbol"><Sparkles size={22} strokeWidth={1.8} /></span><span>nusa<span className="brand-ai">ai</span><span className="brand-dot">.</span></span></a>
}

function LoadingAvatar() {
  return <div className="avatar-loading"><Sparkles size={38} /><span>Menyiapkan Nusa…</span></div>
}

function LandingAvatar({ greeting }) {
  const stageRef = useRef(null)
  const [nearby, setNearby] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setNearby(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearby(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    if (stageRef.current) observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={stageRef} className="landing-avatar-stage"><ErrorBoundary fallback={<div className="avatar-loading"><Sparkles size={38} /><span>Nusa tetap bisa menemanimu lewat chat.</span></div>}>
    {nearby ? <Suspense fallback={<LoadingAvatar />}><AvatarCanvas greeting={greeting} /></Suspense> : <LoadingAvatar />}
  </ErrorBoundary></div>
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
  return <main className="page-recovery" role="alert"><Sparkles size={36} /><h1>Halaman belum bisa dimuat.</h1><p>Periksa koneksi, lalu coba muat ulang untuk melanjutkan.</p><div><button className="button button-dark" onClick={() => window.location.reload()}>Muat ulang</button><button className="button" onClick={onBack}>Kembali ke beranda</button></div></main>
}

function LandingPage({ openChat }) {
  const menuButtonRef = useRef(null)
  const mainRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [region, setRegion] = useState('Semua destinasi')
  const [faqOpen, setFaqOpen] = useState(0)
  const [greeting, setGreeting] = useState(0)
  const [demoInput, setDemoInput] = useState('')

  useEffect(() => {
    // Mount also occurs after returning from the chat route.
    mainRef.current?.focus({ preventScroll: true })
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) }
    }), { threshold: 0.08 })
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

  const closeMenu = () => setMenuOpen(false)
  const filteredDestinations = destinations.filter(destination => region === 'Semua destinasi' || destination.region === region)

  return <div className="landing-page"><a className="skip-link" href="#konten">Langsung ke konten</a>
    <header className="site-header cinema-header">
      <div className="nav-container">
        <Brand />
        <nav id="main-navigation" aria-label="Navigasi utama" className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
          <a href="#kenalan" onClick={closeMenu}>Temui Nusa</a>
          <a href="#destinasi" onClick={closeMenu}>Jelajah destinasi</a>
          <a href="#cara-kerja" onClick={closeMenu}>Cara kerja</a>
        </nav>
        <div className="nav-actions"><span className="language"><Globe2 size={15} /> ID</span><button className="button button-lime nav-cta" onClick={() => openChat()}>Mulai ngobrol <ArrowUpRight size={16} /></button><button ref={menuButtonRef} className="mobile-menu icon-button" aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </div>
    </header>
    <main ref={mainRef} id="konten" tabIndex={-1}>
      <section className="cinema-hero" id="beranda">
        <LandingFilm />
        <div className="section-container cinema-content">
          <div className="cinema-copy">
            <div className="eyebrow"><span className="live-dot" /> TEMAN AI UNTUK JELAJAH INDONESIA</div>
            <h1>Satu obrolan.<br />Sejuta <span>perjalanan.</span></h1>
            <p>Dunia terlalu indah untuk sekadar dibayangkan. Temukan tempat, susun rencana, dan mulai ceritamu bersama Nusa.</p>
            <div className="cinema-actions"><button className="button button-lime button-large" onClick={() => openChat()}>Jelajahi bersama Nusa <ArrowUpRight size={20} /></button><a href="#kenalan">Temui teman jalanmu <ArrowDown size={16} /></a></div>
            <div className="cinema-note"><span className="cinema-avatar-dots" aria-hidden="true"><span>N</span><span>✳</span><span>↗</span></span><span>Mulai dari demo. Tanpa daftar dulu.</span></div>
          </div>
          <a href="#kenalan" className="cinema-scroll" aria-label="Gulir untuk berkenalan dengan Nusa"><ArrowDown size={18} /><span>ADA CERITA DI BAWAH</span></a>
        </div>
        <div className="cinema-details">
          <div><span>01 / TEMAN PERJALANAN</span><strong>Avatar anime 3D<span>Ekspresi yang ikut bercerita.</span></strong></div>
          <div><span>02 / DARI IDE KE RENCANA</span><strong>Jelajah dengan caramu<span>Destinasi, kuliner, dan itinerary.</span></strong></div>
          <div><span>03 / MULAI SESANTAI ITU</span><strong>Ketik. Cerita. Berangkat.<span>Demo tersedia tanpa akun.</span></strong></div>
        </div>
      </section>
      <section className="companion-intro" id="kenalan"><div className="section-container companion-intro-inner">
        <div className="companion-intro-stage"><span className="companion-orbit companion-orbit-one"/><span className="companion-orbit companion-orbit-two"/><div className="companion-intro-avatar"><LandingAvatar greeting={greeting} /></div><div className="companion-stage-label"><span className="live-dot"/> NUSA / YOUR TRAVEL COMPANION</div><button className="companion-wave" aria-label="Sapa Nusa" onClick={() => setGreeting(value => value + 1)}>Sapa Nusa <span>👋</span></button><span className="companion-stage-coordinate">8°39′ S &nbsp; 119°34′ E</span></div>
        <div className="companion-intro-copy" data-reveal><div className="eyebrow"><span className="section-index">01 /</span> KENALAN DENGAN NUSA</div><h2>Ada teman.<br />Di setiap <span>rencana.</span></h2><p>Hai, aku Nusa. Teman anime 3D yang mendengarkan idemu, ikut penasaran, dan membantumu menemukan sisi lain Indonesia.</p><div className="companion-feature-tabs"><span><AudioLines size={15}/> Suara & ekspresi</span><span><Compass size={15}/> Ide perjalanan</span></div><div className="companion-intro-note"><strong>3D</strong><span>Bergerak, berkedip, dan menyapamu.<br />Satu teman untuk banyak cerita.</span></div><button className="text-button" onClick={() => openChat()}>Mulai percakapan <ArrowUpRight size={19}/></button></div>
      </div></section>
      <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0, 1, 2, 3].map(i => <span key={i}>LESS PLANNING <span>✳</span> MORE EXPLORING <span>✳</span> YOUR OWN PACE <span>✳</span> WITH NUSA <span>✳</span></span>)}</div></div>
      <section className="destinations-section section-container" id="destinasi">
        <div className="section-heading" data-reveal><div><div className="eyebrow"><span className="section-index">02 /</span> BERANGKAT DARI RASA PENASARAN</div><h2>Indonesia selalu punya<br /><span className="serif-accent">cerita berikutnya.</span></h2></div><p>Dari tenangnya pesisir sampai hangatnya kota.<br />Temukan perjalanan yang terasa seperti kamu.</p></div>
        <div className="destination-toolbar" data-reveal><div className="filter-tabs" role="group" aria-label="Filter wilayah">{['Semua destinasi', 'Jawa', 'Bali & Nusa Tenggara'].map(item => <button key={item} className={region === item ? 'filter-tab active' : 'filter-tab'} aria-pressed={region === item} onClick={() => setRegion(item)}>{item}</button>)}</div><span className="destination-count">{filteredDestinations.length.toString().padStart(2, '0')} tempat, tak terbatas cerita <ArrowDownRight size={16} /></span></div>
        <div className="destination-grid">{filteredDestinations.map(destination => <button className="destination-card" key={destination.name} onClick={() => openChat(destination.prompt)}><div className="destination-image"><img loading="lazy" src={destination.image} alt={destination.alt} /><span className="destination-tag">{destination.tag}</span><span className="destination-open"><ArrowUpRight size={23} /></span><div className="destination-image-title"><MapPin size={16} /> INDONESIA</div></div><div className="destination-info"><div><h3>{destination.name}</h3><p>{destination.caption}</p></div><ArrowUpRight size={21} /></div></button>)}</div>
        <div className="destination-bottom"><span>Belum tahu mau ke mana? Itu juga awal yang bagus.</span><button className="text-button" onClick={() => openChat('Aku belum tahu mau liburan ke mana. Bantu aku memilih destinasi sesuai minatku.')}>Cari inspirasi bareng Nusa <ArrowRight size={17} /></button></div>
      </section>
      <section className="meet-section" id="obrolan"><div className="section-container meet-inner">
        <div className="meet-copy" data-reveal><div className="eyebrow"><span className="section-index">03 /</span> KENALAN DENGAN NUSA</div><h2>Bukan cuma jawaban.<br />Ada <span className="serif-accent">teman di sana.</span></h2><p>Rencana perjalanan seharusnya terasa menyenangkan. Ceritakan idemu, tanyakan hal kecil, atau mulai dari “aku butuh liburan”. Nusa akan ikut merangkainya.</p><div className="meet-feature"><span><MessageCircle size={20} /></span><div><h3>Ngobrol senyaman sama teman</h3><p>Bahasa sehari-hari. Ide yang mengikuti minatmu.</p></div></div><div className="meet-feature"><span><AudioLines size={20} /></span><div><h3>Punya suara. Punya ekspresi.</h3><p>Avatar bergerak saat diam, berpikir, dan merespons.</p></div></div><button className="button button-dark" onClick={() => openChat()}>Yuk, mulai ngobrol <ArrowUpRight size={17} /></button></div>
        <div className="meet-demo" data-reveal><div className="demo-topbar"><span className="demo-brand"><Sparkles size={16} /> nusa ai</span><span><span className="live-dot" /> SELALU ADA CERITA</span></div><div className="demo-message demo-message-user">Aku butuh liburan, tapi bingung ke mana 🙃</div><div className="demo-message-row"><span className="demo-avatar"><Sparkles size={18} /></span><div className="demo-message demo-message-nusa">Mulai dari yang kamu suka, yuk.<br />Tim suara ombak atau udara pegunungan?<span className="message-time">Contoh percakapan</span></div></div><div className="demo-options"><button onClick={() => openChat('Aku ingin liburan ke pantai yang tenang di Indonesia. Ada rekomendasi?')}>🌊 &nbsp; Suara ombak</button><button onClick={() => openChat('Aku ingin liburan ke pegunungan di Indonesia. Ada rekomendasi?')}>🌿 &nbsp; Udara pegunungan</button></div><form className="demo-composer" onSubmit={event => { event.preventDefault(); openChat(demoInput.trim() || undefined) }}><input aria-label="Tulis ide perjalanan untuk Nusa" placeholder="Cerita sedikit tentang liburan impianmu…" value={demoInput} onChange={event => setDemoInput(event.target.value)} maxLength={2000} /><button type="submit" aria-label="Mulai percakapan"><ArrowUpRight size={18} /></button></form><span className="demo-caption"><Volume2 size={13} /> Satu percakapan. Banyak kemungkinan.</span></div>
      </div></section>
      <section className="how-section section-container" id="cara-kerja"><div className="section-heading" data-reveal><div><div className="eyebrow"><span className="section-index">04 /</span> GAMPANG DARI AWAL</div><h2>Rencana besar,<br /><span className="serif-accent">mulai dari obrolan kecil.</span></h2></div><span className="handdrawn-arrow" aria-hidden="true"><svg viewBox="0 0 140 75" fill="none"><path d="M5 15C30 0 36 61 71 38S128 19 120 61M106 49L120 65L134 51" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span></div><div className="steps-grid">{[{ number: '01', icon: MessageCircle, title: 'Ceritakan keinginanmu.', description: 'Tujuan, durasi, atau sekadar suasana yang kamu cari. Mulai sesantai itu.' }, { number: '02', icon: Compass, title: 'Temukan kemungkinan.', description: 'Jelajahi ide destinasi, kuliner lokal, dan rute perjalanan bersama Nusa.' }, { number: '03', icon: Navigation, title: 'Bawa ceritamu pergi.', description: 'Rapikan rencana, cek detail perjalanan, lalu berangkat dengan caramu.' }].map(step => <div className="step" key={step.number} data-reveal><div className="step-top"><span>{step.number}</span><step.icon size={25} strokeWidth={1.4} /></div><h3>{step.title}</h3><p>{step.description}</p></div>)}</div></section>
      <section className="faq-section section-container"><div data-reveal><div className="eyebrow">SEDIKIT JAWABAN SEBELUM JALAN</div><h2>Masih <span className="serif-accent">penasaran?</span></h2><p>Wajar. Nusa juga suka banyak tanya.</p><button className="text-button" onClick={() => openChat()}>Tanya langsung ke Nusa <ArrowUpRight size={17} /></button></div><div className="faq-list">{questions.map((item, index) => <div className={faqOpen === index ? 'faq-item expanded' : 'faq-item'} key={item.q}><h3><button aria-expanded={faqOpen === index} aria-controls={'faq-' + index} onClick={() => setFaqOpen(faqOpen === index ? null : index)}>{item.q}<ChevronDown size={19} /></button></h3><div className="faq-answer" id={'faq-' + index} hidden={faqOpen !== index}><p>{item.a}</p></div></div>)}</div></section>
      <section className="closing-section section-container" data-reveal><span className="closing-sparkle" aria-hidden="true">✳</span><div className="eyebrow">PETUALANGANMU BELUM DIMULAI.</div><h2>Ke mana pun langkahmu,<br /><span className="serif-accent">yuk, jalan bareng.</span></h2><button className="button button-lime button-large" onClick={() => openChat()}>Temui Nusa sekarang <ArrowUpRight size={20} /></button><p>Mulai dengan satu “hai”. Sisanya kita cari bersama.</p><span className="closing-orbit" aria-hidden="true" /></section>
    </main>
    <footer className="site-footer section-container"><div className="footer-main"><Brand /><p>Teman untuk setiap rasa ingin tahu.</p><a href="#beranda" className="back-top">Kembali ke atas <ArrowUpRight size={16} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Nusa AI. Dibuat untuk penjelajah.</span><span>Indonesia, one conversation at a time. <Globe2 size={13} /></span></div></footer>
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
  return page === 'chat' ? <Suspense fallback={<div className="app-loading"><Sparkles size={30} /><p>Nusa sedang bersiap…</p></div>}><ErrorBoundary fallback={<PageRecovery onBack={backHome} />}><ChatPage onBack={backHome} initialPrompt={initialPrompt} /></ErrorBoundary></Suspense> : <LandingPage openChat={openChat} />
}
