import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, LoaderCircle, RefreshCw, RotateCcw, SwitchCamera, X } from 'lucide-react'
import { cameraErrorMessage, captureCameraFrame, createCameraSession } from '../lib/cameraCapture'
import './CameraCapture.css'

export default function CameraCapture({ onClose, onCapture }) {
  const [facing, setFacing] = useState('environment')
  const [attempt, setAttempt] = useState(0)
  const [starting, setStarting] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const videoRef = useRef(null)
  const dialogRef = useRef(null)
  const captureInputRef = useRef(null)
  const cameraRef = useRef(null)
  const mountedRef = useRef(true)
  const photoRef = useRef(null)
  const pendingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const previous = document.activeElement
    dialogRef.current?.querySelector('button')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return
      const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(node => node.getClientRects().length)
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const suspend = () => {
      if (!document.hidden) return
      stopCamera()
      setReady(false); setStarting(false)
      if (!photoRef.current) setError('Kamera dijeda saat kamu meninggalkan halaman. Tekan Coba lagi untuk melanjutkan.')
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('visibilitychange', suspend)
    window.addEventListener('pagehide', stopCamera)
    return () => {
      mountedRef.current = false
      stopCamera()
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('visibilitychange', suspend)
      window.removeEventListener('pagehide', stopCamera)
      previous?.focus?.()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!photo) { setPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    if (photo) return
    stopCamera()
    setStarting(true); setReady(false); setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false)
      setError(window.isSecureContext === false ? 'Pratinjau kamera memerlukan HTTPS atau localhost. Gunakan kamera perangkat di bawah, atau buka aplikasi melalui HTTPS.' : 'Pratinjau kamera belum didukung browser ini. Gunakan kamera perangkat di bawah.')
      return
    }
    let active = true
    const camera = createCameraSession({
      mediaDevices: navigator.mediaDevices,
      onStream: stream => {
        if (!active || !videoRef.current) { camera.stop(); return }
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(cause => {
          if (!active) return
          camera.stop(); setStarting(false); setReady(false); setError(cameraErrorMessage(cause))
        })
      },
      onError: message => { if (active) { setStarting(false); setReady(false); setError(message) } },
    })
    cameraRef.current = camera
    camera.start(facing)
    return () => { active = false; camera.stop(); if (cameraRef.current === camera) cameraRef.current = null }
  }, [attempt, facing, photo, stopCamera])

  function choosePhoto(file) {
    stopCamera(); setReady(false); setStarting(false); setError('')
    photoRef.current = file
    setPhoto(file)
  }

  async function takePhoto() {
    if (!ready || pendingRef.current) return
    pendingRef.current = true; setBusy(true); setError('')
    try {
      const file = await captureCameraFrame(videoRef.current)
      if (mountedRef.current) choosePhoto(file)
    } catch (cause) { if (mountedRef.current) setError(cause.message) }
    finally { pendingRef.current = false; if (mountedRef.current) setBusy(false) }
  }

  function attachPhoto() {
    if (!photo || pendingRef.current) return
    pendingRef.current = true
    const message = onCapture(photo)
    pendingRef.current = false
    if (message) setError(message)
  }

  return <div className="chat-camera-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="chat-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title" aria-describedby="camera-description" ref={dialogRef}>
      <header><span className="chat-camera-icon"><Camera size={22}/></span><div><h2 id="camera-title">{photo ? 'Foto sudah siap.' : 'Tangkap cerita di sekitarmu.'}</h2><p id="camera-description">{photo ? 'Periksa fotonya sebelum ditambahkan ke pesan.' : 'Ambil foto, lalu tanyakan langsung ke Nusa.'}</p></div><button type="button" className="chat-camera-close" onClick={onClose} aria-label="Tutup kamera"><X size={21}/></button></header>
      <div className={`chat-camera-stage ${photo ? 'has-photo' : ''}`}>
        {photo ? <img src={preview} alt="Pratinjau foto kamera yang akan dilampirkan"/> : <video ref={videoRef} autoPlay playsInline muted className={facing === 'user' ? 'is-front-camera' : ''} aria-label="Pratinjau kamera" onCanPlay={() => { if (cameraRef.current && !document.hidden && videoRef.current?.srcObject) { setReady(true); setStarting(false) } }}/>}
        {!photo && !ready && <div className="chat-camera-placeholder">{starting ? <><LoaderCircle size={29} className="chat-spinner"/><span>Menyiapkan kamera…</span></> : <><Camera size={35}/><span>Pratinjau kamera belum tersedia</span></>}</div>}
        {!photo && ready && <span className="chat-camera-live"><i/> KAMERA AKTIF</span>}
      </div>
      {error && <p className="chat-camera-error" role="alert">{error}</p>}
      <div className="chat-camera-actions">{photo ? <><button type="button" className="chat-camera-secondary" onClick={() => { photoRef.current = null; setPhoto(null); setError('') }}><RotateCcw size={17}/> Ambil ulang</button><button type="button" className="chat-camera-primary" onClick={attachPhoto}><Check size={18}/> Gunakan foto</button></> : <><button type="button" className="chat-camera-secondary" disabled={starting || busy || !ready} onClick={() => setFacing(value => value === 'environment' ? 'user' : 'environment')}><SwitchCamera size={18}/> Balik kamera</button><button type="button" className="chat-camera-primary" disabled={!ready || busy} onClick={takePhoto}>{busy ? <LoaderCircle size={19} className="chat-spinner"/> : <Camera size={19}/>} Ambil foto</button></>}</div>
      {!photo && error && <div className="chat-camera-fallback"><button type="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15}/> Coba lagi</button><button type="button" onClick={() => { stopCamera(); setReady(false); setStarting(false); captureInputRef.current?.click() }}><Camera size={16}/> Buka kamera perangkat</button></div>}
      <input ref={captureInputRef} type="file" accept="image/*" capture={facing} className="chat-file-input" aria-label="Ambil foto menggunakan kamera perangkat" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) choosePhoto(file) }}/>
      <p className="chat-camera-note">Foto ditambahkan sebagai lampiran. Kirim pesan untuk membagikannya ke Nusa.</p>
    </section>
  </div>
}
