import { useContext, useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, ChevronDown, Compass, Pause, Play, Send } from 'lucide-react'
import { SceneStage } from './LandingMotion'
import { MotionContext } from './landingMotionContext'

const questions = [
  { q: 'Nusa AI itu apa, sih?', a: 'Teman perjalanan virtual dengan karakter 3D khas Nusa. Bertukar ide destinasi, susun rute, dan temukan sisi lain Indonesia lewat obrolan santai.' },
  { q: 'Bagaimana mulai mengobrol?', a: 'Masuk atau buat akun, lalu ceritakan rencana perjalananmu. Semua pesan dikirim langsung ke layanan AI yang terhubung.' },
  { q: 'Bisa ngobrol lewat suara?', a: 'Pada browser yang mendukung, tombol mikrofon mengubah ucapanmu menjadi pesan. Nusa juga dapat membacakan jawaban dengan suara yang tersedia di perangkatmu.' },
  { q: 'Bisa pesan hotel atau tiket?', a: 'Nusa membantu merencanakan perjalanan. Pemesanan dilanjutkan melalui penyedia pilihanmu. Periksa kembali harga, jam buka, dan kondisi destinasi sebelum berangkat.' },
]

function MotionControl() {
  const { paused, setPaused, reducedMotion } = useContext(MotionContext)
  return <button type="button" className="expedition-motion-button" aria-pressed={paused} aria-label={paused ? 'Lanjutkan gerakan 3D' : 'Jeda gerakan 3D'} disabled={reducedMotion} onClick={() => setPaused(value => !value)}>{paused ? <Play size={13}/> : <Pause size={13}/>}<span>{reducedMotion ? 'Gerakan dikurangi' : paused ? 'Lanjutkan gerakan' : 'Jeda gerakan'}</span></button>
}

export default function ExpeditionStory({ openChat }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(0)
  const [chapter, setChapter] = useState(0)
  const [visible, setVisible] = useState(false)
  const storyRef = useRef(null)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const chapters = [...storyRef.current.querySelectorAll('[data-expedition-chapter]')]
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setChapter(chapters.indexOf(entry.target))
    }), { threshold: .4 })
    chapters.forEach(element => observer.observe(element))
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    visibility.observe(storyRef.current)
    return () => { observer.disconnect(); visibility.disconnect() }
  }, [])
  return <section ref={storyRef} className="expedition-story" data-scroll-story aria-label="Dari rasa penasaran ke perjalanan">
    <div className="expedition-sticky"><div className="expedition-atmosphere" aria-hidden="true"/><SceneStage kind="expedition" progressMode="story" interaction={open} className="expedition-world-stage" label="Kompas Nusa yang berubah menjadi peta perjalanan, penunjuk jawaban, dan globe keberangkatan mengikuti guliran"/><div className="expedition-chapter-guide" aria-hidden="true">{[0, 1, 2, 3].map(index => <span className={chapter === index ? 'is-active' : ''} key={index}/>)}<small>IKUTI RASA. TEMUKAN ARAH.</small></div></div>
    <div className="expedition-chapters">
      <section className="expedition-chapter expedition-talk" id="obrolan" data-expedition-chapter aria-labelledby="expedition-talk-title">
        <div className="expedition-copy"><div className="eyebrow">05 / SEBUAH AWAL</div><h2 id="expedition-talk-title">Cerita kecil.<br/><em>Arah baru.</em></h2><p>“Aku butuh liburan.”<br/>Kadang, empat kata sudah cukup untuk memulai perjalanan.</p>
          <form className="expedition-prompt" onSubmit={event => { event.preventDefault(); openChat(input.trim() || undefined) }}><input aria-label="Ceritakan ide perjalananmu" placeholder="Kamu sedang ingin ke mana?" value={input} onChange={event => setInput(event.target.value)} maxLength={2000}/><button type="submit" aria-label="Mulai obrolan dengan ide perjalananmu"><Send size={17}/></button></form>
          <div className="expedition-suggestions"><button onClick={() => openChat('Aku ingin liburan ke pantai yang tenang di Indonesia. Ada ide?')}>Suara ombak <ArrowUpRight size={13}/></button><button onClick={() => openChat('Aku ingin mencari udara pegunungan untuk liburan singkat. Ada ide?')}>Udara pegunungan <ArrowUpRight size={13}/></button></div><span className="expedition-note">Masuk, ceritakan idemu, dan mulai jelajah.</span>
        </div><span className="expedition-chapter-index">01 / 04 — CERITAKAN</span>
      </section>
      <section className="expedition-chapter expedition-route" id="cara-kerja" data-expedition-chapter aria-labelledby="expedition-route-title">
        <div className="expedition-route-heading"><div><div className="eyebrow">06 / DARI RASA KE RENCANA</div><h2 id="expedition-route-title">Duniamu,<br/><em>mulai terbuka.</em></h2></div><p>Beri ruang untuk rasa penasaran.<br/>Kita temukan arahnya bersama.</p></div>
        <div className="expedition-route-steps">{[{ title: 'Ceritakan.', text: 'Minat, waktu, dan suasana yang kamu cari.' }, { title: 'Jelajahi.', text: 'Temukan ide destinasi dan rute bersama Nusa.' }, { title: 'Berangkat.', text: 'Cek detailnya, lalu bawa ceritamu pergi.' }].map((step, index) => <article key={step.title}><span className="expedition-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div><span className="expedition-chapter-index">02 / 04 — JELAJAHI</span>
      </section>
      <section className="expedition-chapter expedition-help" id="pertanyaan" data-expedition-chapter aria-labelledby="expedition-help-title">
        <div className="expedition-copy"><div className="eyebrow">07 / KENAL LEBIH DEKAT</div><h2 id="expedition-help-title">Rasa ingin tahu<br/><em>punya arah.</em></h2><div className="expedition-faq-list">{questions.map((item, index) => <div className={`expedition-faq-item${open === index ? ' is-open' : ''}`} key={item.q}><h3><button id={`expedition-question-${index}`} aria-expanded={open === index} aria-controls={`expedition-answer-${index}`} onClick={() => setOpen(open === index ? null : index)}><span className="number">0{index + 1}</span><span className="label">{item.q}</span><ChevronDown size={17}/></button></h3><div id={`expedition-answer-${index}`} role="region" aria-labelledby={`expedition-question-${index}`} hidden={open !== index}><p>{item.a}</p></div></div>)}</div><button className="text-button" onClick={() => openChat()}>Tanya langsung ke Nusa <ArrowUpRight size={17}/></button></div><span className="expedition-chapter-index">03 / 04 — TEMUKAN JAWABAN</span>
      </section>
      <section className="expedition-chapter expedition-finale" data-expedition-chapter aria-labelledby="expedition-finale-title">
        <div className="expedition-copy"><div className="eyebrow"><Compass size={13}/> 08 / PERJALANAN BERIKUTNYA</div><h2 id="expedition-finale-title">Ikuti rasa.<br/><em>Ayo pergi.</em></h2><p>Satu “hai” hari ini.<br/>Siapa tahu, jadi awal perjalanan favoritmu.</p><button className="button button-lime" onClick={() => openChat()}>Mulai cerita bersama Nusa <ArrowUpRight size={19}/></button><span className="expedition-note">Cerita berikutnya, punya kamu.</span><a className="text-button" href="#destinasi">Lihat lagi destinasinya <ArrowRight size={16}/></a></div><span className="expedition-chapter-index">04 / 04 — BAWA CERITAMU PERGI</span>
      </section>
    </div>{visible && <MotionControl/>}
  </section>
}
