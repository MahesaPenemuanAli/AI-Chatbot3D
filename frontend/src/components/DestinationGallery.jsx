import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'

const destinations = [
  { name: 'Bali', region: 'Bali & Nusa Tenggara', caption: 'Pelan-pelan. Temukan tenangnya.', image: '/images/bali.jpg', alt: 'Pura di tepi danau dengan pegunungan hijau di Bali', tag: 'Alam & ketenangan', prompt: 'Bantu aku menyusun itinerary santai 3 hari di Bali.' },
  { name: 'Yogyakarta', region: 'Jawa', caption: 'Banyak sudut. Lebih banyak kisah.', image: '/images/borobudur.jpg', alt: 'Stupa Candi Borobudur dengan pegunungan Jawa', tag: 'Budaya & kuliner', prompt: 'Aku ingin menjelajahi budaya dan kuliner Yogyakarta selama 3 hari.' },
  { name: 'Labuan Bajo', region: 'Bali & Nusa Tenggara', caption: 'Sedikit lebih jauh dari biasanya.', image: '/images/padar.jpg', alt: 'Perbukitan Pulau Padar di antara teluk biru Labuan Bajo', tag: 'Laut & petualangan', prompt: 'Buatkan ide perjalanan 3 hari ke Labuan Bajo dan Pulau Padar.' },
]

export default function DestinationGallery({ openChat }) {
  const [region, setRegion] = useState('Semua destinasi')
  const sectionRef = useRef(null)
  const railRef = useRef(null)
  const visible = destinations.filter(item => region === 'Semua destinasi' || item.region === region)

  useEffect(() => {
    const section = sectionRef.current
    const rail = railRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 700px)')
    let frame = 0
    const update = () => {
      frame = 0
      if (motion.matches || mobile.matches) return
      const rect = section.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)))
      rail.scrollLeft = progress * Math.max(0, rail.scrollWidth - rail.clientWidth)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    motion.addEventListener('change', schedule)
    mobile.addEventListener('change', schedule)
    update()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      motion.removeEventListener('change', schedule)
      mobile.removeEventListener('change', schedule)
    }
  }, [region])

  const moveRail = direction => {
    const rail = railRef.current
    const cards = [...rail.querySelectorAll('.destination-card')]
    if (!cards.length) return
    const center = rail.getBoundingClientRect().left + rail.clientWidth / 2
    const centers = cards.map(card => { const rect = card.getBoundingClientRect(); return rect.left + rect.width / 2 })
    const current = centers.reduce((closest, value, index) => Math.abs(value - center) < Math.abs(centers[closest] - center) ? index : closest, 0)
    const target = Math.min(cards.length - 1, Math.max(0, current + direction))
    rail.scrollBy({ left: centers[target] - center, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return <section className="destination-gallery" id="destinasi" ref={sectionRef}>
    <div className="destination-sticky"><div className="gallery-heading section-container"><div><div className="eyebrow">03 / PERGI DENGAN RASA PENASARAN</div><h2>Tempat baru.<br/><em>Cerita berikutnya.</em></h2></div><div className="gallery-heading-side"><p>Ke mana pun rasa ingin tahumu pergi,<br/>kita mulai dari sini.</p><div className="gallery-arrows"><button aria-label="Destinasi sebelumnya" onClick={() => moveRail(-1)}><ArrowLeft size={18}/></button><button aria-label="Destinasi berikutnya" onClick={() => moveRail(1)}><ArrowRight size={18}/></button></div></div></div>
      <div className="gallery-toolbar section-container"><div className="filter-tabs" role="group" aria-label="Filter wilayah">{['Semua destinasi', 'Jawa', 'Bali & Nusa Tenggara'].map(item => <button key={item} className={region === item ? 'filter-tab active' : 'filter-tab'} aria-pressed={region === item} onClick={() => setRegion(item)}>{item}</button>)}</div><span className="gallery-drag-note">GULIR UNTUK MENJELAJAH <ArrowRight size={13}/></span></div>
      <div className="destination-rail" ref={railRef} tabIndex={0} role="region" aria-label="Pilihan destinasi Indonesia">
        {visible.map((destination, index) => <button className="destination-card" key={destination.name} onClick={() => openChat(destination.prompt)}><div className="destination-image"><img loading="lazy" src={destination.image} alt={destination.alt}/><span className="destination-card-index">0{index + 1} / INDONESIA</span><span className="destination-tag"><MapPin size={11}/>{destination.tag}</span><span className="destination-open"><ArrowUpRight size={23}/></span><div className="destination-image-title"><h3>{destination.name}</h3><p>{destination.caption}</p></div></div></button>)}
      </div>
      <div className="gallery-bottom section-container"><span>Belum tahu mau ke mana? Itu juga sebuah awal.</span><button className="text-button" onClick={() => openChat('Aku belum tahu mau liburan ke mana. Bantu aku memilih destinasi sesuai minatku.')}>Cari inspirasi bersama Nusa <ArrowUpRight size={17}/></button></div>
    </div>
  </section>
}
