export function cameraErrorMessage(error) {
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) return 'Akses kamera belum diizinkan. Izinkan kamera untuk situs ini melalui pengaturan browser, lalu coba lagi.'
  if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'Kamera tidak ditemukan. Hubungkan kamera atau gunakan tombol kamera perangkat di bawah.'
  if (['NotReadableError', 'TrackStartError'].includes(error?.name)) return 'Kamera sedang digunakan aplikasi lain atau belum dapat dibuka. Tutup aplikasi tersebut, lalu coba lagi.'
  return 'Kamera belum dapat dibuka. Coba lagi atau gunakan kamera perangkat di bawah.'
}

const stopStream = stream => stream?.getTracks().forEach(track => track.stop())

/** Owns the stream and cancels late permission results on close or camera switch. */
export function createCameraSession({ mediaDevices, onStream, onError }) {
  let version = 0
  let stream = null
  const stop = () => { version += 1; stopStream(stream); stream = null }
  return {
    stop,
    async start(facingMode = 'environment') {
      stop()
      const current = version
      try {
        const incoming = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1600 }, height: { ideal: 1200 } } })
        if (current !== version) { stopStream(incoming); return false }
        stream = incoming
        onStream(incoming)
        return true
      } catch (error) {
        if (current === version) { stopStream(stream); stream = null; onError(cameraErrorMessage(error)) }
        return false
      }
    },
  }
}

export async function captureCameraFrame(video, { createCanvas = () => document.createElement('canvas'), makeFile = (blob, name) => new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }) } = {}) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('Tunggu hingga pratinjau kamera siap, lalu ambil foto lagi.')
  const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
  const canvas = createCanvas()
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Foto belum dapat diproses. Coba kamera perangkat di bawah.')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88))
  if (!blob?.size) throw new Error('Foto belum berhasil diambil. Coba sekali lagi.')
  return makeFile(blob, `nusa-kamera-${Date.now()}.jpg`)
}
