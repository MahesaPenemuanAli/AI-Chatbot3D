import NusaMark from './NusaMark'
import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, AudioLines, ChevronDown, Compass, Leaf, MapPin, MessageCircle, Mountain, Send, Waves } from 'lucide-react'
import { SceneStage } from './LandingMotion'

const questions = [
  { q: 'Nusa AI itu apa, sih?', a: 'Nusa adalah teman perjalanan virtual dengan karakter 3D khas Nusa AI. Kamu bisa bertukar ide destinasi, menyusun rute, dan menemukan inspirasi wisata Indonesia lewat percakapan yang santai.' },
  { q: 'Bagaimana mulai mengobrol?', a: 'Masuk atau buat akun untuk memulai percakapan dengan Nusa. Semua pesan dikirim langsung ke layanan AI yang terhubung.' },
  { q: 'Apakah Nusa bisa diajak bicara?', a: 'Bisa, pada browser yang mendukung pengenalan suara. Tombol mikrofon mengubah ucapanmu menjadi pesan, dan Nusa dapat membacakan jawaban menggunakan suara yang tersedia di perangkatmu.' },
  { q: 'Bisa memesan hotel atau tiket di sini?', a: 'Nusa membantu menyusun rencana perjalanan. Untuk hotel, transportasi, dan tiket, lanjutkan pemesanan melalui penyedia pilihanmu. Periksa kembali harga, jam buka, dan kondisi destinasi sebelum berangkat.' },
]

function Conversation({ openChat }) {
  const [input, setInput] = useState('')
  return <section className="landing-conversation" id="obrolan" aria-labelledby="conversation-title">
    <div className="section-container landing-conversation-grid">
      <div className="landing-conversation-copy" data-reveal>
        <div className="eyebrow"><span/> 05 / IDE BESAR, OBROLAN KECIL</div>
        <h2 id="conversation-title">Rencana seru.<br/>Dimulai dari<br/><em>obrolan kecil.</em></h2>
        <p>Belum punya tujuan? Tidak apa-apa. Ceritakan suasana yang kamu cari, biar Nusa membantu menemukan arahnya.</p>
        <SceneStage kind="conversation" label="Gelembung percakapan tiga dimensi yang melayang dengan titik ketik dan gelombang suara" caption="SATU OBROLAN. BANYAK KEMUNGKINAN."/>
        <div className="landing-conversation-benefits"><span><MessageCircle size={16}/> Pakai bahasamu sendiri</span><span><AudioLines size={16}/> Bisa lewat suara</span></div>
        <a className="landing-scroll-note" href="#cara-kerja"><span><ArrowDown size={17}/></span> Dari ide sampai siap pergi</a>
      </div>
      <div className="landing-chat-preview" data-reveal>
        <div className="landing-chat-header"><span className="landing-chat-icon"><Leaf size={21}/></span><div><strong>Nusa</strong><span>Teman jelajahmu</span></div><span className="landing-preview-label">PRATINJAU</span></div>
        <div className="landing-chat-body"><span className="landing-chat-date">SEBUAH AWAL YANG SEDERHANA</span>
          <div className="landing-bubble landing-bubble-user">Aku butuh liburan, tapi bingung ke mana.</div>
          <div className="landing-bubble-row"><span className="landing-chat-small-avatar"><NusaMark size={16}/></span><div className="landing-bubble landing-bubble-nusa">Mulai dari yang kamu suka, yuk. <span aria-hidden="true">🌿</span><br/>Tim suara ombak atau udara pegunungan?</div></div>
          <div className="landing-chat-options"><button onClick={() => openChat('Aku ingin liburan ke pantai yang tenang di Indonesia. Ada rekomendasi?')}><Waves size={15}/> Suara ombak <ArrowUpRight size={13}/></button><button onClick={() => openChat('Aku ingin liburan ke pegunungan di Indonesia. Ada rekomendasi?')}><Mountain size={15}/> Udara pegunungan <ArrowUpRight size={13}/></button></div>
        </div>
        <form className="landing-chat-composer" onSubmit={event => { event.preventDefault(); openChat(input.trim() || undefined) }}><input aria-label="Tulis ide perjalanan untuk Nusa" placeholder="Kalau kamu, ingin ke mana?" value={input} onChange={event => setInput(event.target.value)} maxLength={2000}/><button type="submit" aria-label="Kirim ide dan mulai percakapan"><Send size={17}/></button></form>
        <p className="landing-chat-footnote">Ilustrasi percakapan · Mulai chat untuk jawaban AI</p>
      </div>
    </div>
  </section>
}

function JourneySteps() {
  return <section className="landing-steps" id="cara-kerja" aria-labelledby="steps-title"><div className="section-container">
    <div className="landing-steps-heading" data-reveal><div className="eyebrow">06 / DARI PIKIRAN KE PERJALANAN</div><h2 id="steps-title">Sedikit cerita.<br/><em>Banyak kemungkinan.</em></h2><p>Tak perlu tahu semua jawabannya.<br/>Mulai saja dari rasa ingin pergi.</p></div>
    <SceneStage kind="map" className="journey-map-stage" label="Peta perjalanan tiga dimensi yang terbuka saat digulir, dengan pulau, gunung, pin destinasi, dan pesawat" caption="GULIR. BUKA PETA. TEMUKAN ARAHMU."/>
    <div className="landing-steps-grid">
      <article className="landing-step" data-reveal><div className="landing-step-node"><span>01</span><MessageCircle size={21}/></div><h3>Ceritakan keinginanmu.</h3><p>Tujuan, durasi, atau suasana yang kamu cari. Semuanya bisa jadi titik awal.</p></article>
      <article className="landing-step" data-reveal><div className="landing-step-node"><span>02</span><Compass size={21}/></div><h3>Temukan yang terasa pas.</h3><p>Jelajahi ide destinasi, kuliner lokal, dan rute perjalanan bersama Nusa.</p></article>
      <article className="landing-step" data-reveal><div className="landing-step-node"><span>03</span><MapPin size={21}/></div><h3>Bawa ceritamu pergi.</h3><p>Rapikan rencana, cek detail perjalanan, lalu berangkat dengan caramu.</p></article>
    </div>
    <div className="landing-steps-end"><span><NusaMark size={14}/> Rasa penasaran adalah kompasmu.</span><span>SELANJUTNYA: CERITA MILIKMU <ArrowRight size={14}/></span></div>
  </div></section>
}

function Questions({ openChat }) {
  const [open, setOpen] = useState(0)
  return <section className="landing-questions" id="pertanyaan" aria-labelledby="questions-title"><div className="section-container landing-questions-grid">
    <div className="landing-questions-intro" data-reveal><div className="eyebrow">SEBELUM KITA BERANGKAT</div><h2 id="questions-title">Biar makin<br/><em>kenal Nusa.</em></h2><p>Beberapa hal yang mungkin<br/>sedang kamu pikirkan.</p><SceneStage kind="questions" interaction={open} label="Kompas dan tanda tanya tiga dimensi yang berputar mengikuti pertanyaan yang dipilih" caption="PILIH PERTANYAAN. TEMUKAN ARAHNYA."/><div className="landing-question-note"><span><MessageCircle size={21}/></span><div><strong>Masih ada yang ingin ditanyakan?</strong><button className="text-button" onClick={() => openChat()}>Tanya langsung ke Nusa <ArrowUpRight size={17}/></button></div></div></div>
    <div className="landing-questions-list">{questions.map((item, index) => <div className={`landing-question${open === index ? ' is-open' : ''}`} key={item.q}><h3><button aria-expanded={open === index} aria-controls={`nusa-answer-${index}`} id={`nusa-question-${index}`} onClick={() => setOpen(open === index ? null : index)}><span className="landing-question-number">0{index + 1}</span><span>{item.q}</span><span className="landing-question-toggle"><ChevronDown size={17}/></span></button></h3><div id={`nusa-answer-${index}`} role="region" aria-labelledby={`nusa-question-${index}`} hidden={open !== index}><p>{item.a}</p></div></div>)}</div>
  </div></section>
}

function Closing({ openChat }) {
  return <section className="landing-departure" aria-labelledby="departure-title"><div className="section-container landing-departure-grid">
    <div className="landing-departure-copy" data-reveal><div className="eyebrow"><span/> TAK HARUS JAUH. YANG PENTING, MULAI.</div><h2 id="departure-title">Cerita berikutnya,<br/><em>punya kamu.</em></h2><p>Satu “hai” hari ini.<br/>Siapa tahu, jadi awal perjalanan favoritmu.</p><button className="button button-lime" onClick={() => openChat()}>Mulai ngobrol dengan Nusa <ArrowUpRight size={20}/></button><span className="landing-departure-note">Masuk untuk mulai mengobrol dengan Nusa</span></div>
    <SceneStage kind="departure" className="departure-world" label="Globe hijau tiga dimensi dengan cincin kompas dan pesawat yang terbang mengelilinginya" caption="PERJALANAN BERIKUTNYA, MILIKMU."/>
  </div><span className="landing-departure-orbit" aria-hidden="true"/></section>
}

export default function LandingDetails({ openChat }) {
  return <><Conversation openChat={openChat}/><JourneySteps/><Questions openChat={openChat}/><Closing openChat={openChat}/></>
}
