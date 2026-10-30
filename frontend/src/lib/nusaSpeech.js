// Browser speech stays local to the browser/provider chosen by the device.
// Keep the speech clock separate from the text reveal so Nusa never lip-syncs silence.
export function cleanNusaSpeech(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/^[ \t]*(?:#{1,6}\s+|>\s*|[-*•]\s+)/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f/gu, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '. ')
    .replace(/([.!?:;,])\s*\./g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function selectNusaVoice(voices = []) {
  const ranked = voices.filter(voice => /^(?:id|in)(?:[-_]|$)/i.test(voice.lang || ''))
    .map((voice, index) => {
      const name = voice.name || ''
      const score = (/natural|neural|premium|enhanced/i.test(name) ? 50 : 0)
        + (/google/i.test(name) ? 20 : /microsoft/i.test(name) ? 15 : 0)
        + (/^id[-_]id$/i.test(voice.lang) ? 8 : 0)
        + (voice.default ? 2 : 0)
      return { voice, score, index }
    }).sort((a, b) => b.score - a.score || a.index - b.index)
  return ranked[0]?.voice || null
}

// Bound utterances to avoid the long-utterance stalls seen in browser TTS.
// Punctuation remains with its clause; no response-length cutoff is applied.
export function splitNusaSpeech(value, limit = 180) {
  const text = cleanNusaSpeech(value)
  if (!text) return []
  const chunks = []
  let rest = text
  const max = Math.max(40, limit)
  while (rest.length > max) {
    const window = rest.slice(0, max + 1)
    const breaks = [...window.matchAll(/[.!?;:,]\s+|\s+/g)]
    const punctuation = breaks.filter(match => /[.!?;:,]/.test(match[0]) && match.index >= max * .35)
    const word = breaks.filter(match => match.index > 0)
    const last = punctuation.at(-1) || word.at(-1)
    const end = last ? last.index + last[0].trimEnd().length : max
    chunks.push(rest.slice(0, end).trim())
    rest = rest.slice(end).trimStart()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export function createNusaSpeech({
  synthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  activity,
  onSpeaking = () => {},
  onError = () => {},
  now = () => globalThis.performance?.now() ?? Date.now(),
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  let version = 0
  let disposed = false
  let timer = null
  let pending = null
  let voices = []
  let activeUtterance = null
  const update = fields => {
    if (activity) activity.current = { active: false, startedAt: 0, boundaryAt: 0, boundarySupported: false, energy: 0, ...activity.current, ...fields }
  }
  const refreshVoices = () => { voices = Array.from(synthesis?.getVoices?.() || []) }
  const stop = () => {
    version += 1
    if (timer !== null) clearTimer(timer)
    timer = null
    pending = null
    activeUtterance = null
    update({ active: false, energy: 0, boundarySupported: false, boundaryAt: 0 })
    synthesis?.cancel?.()
    if (!disposed) onSpeaking(false)
  }
  const run = (chunks, current) => {
    if (disposed || current !== version) return
    const voice = selectNusaVoice(voices)
    if (voices.length && !voice) {
      onError('Suara bahasa Indonesia belum tersedia. Tambahkan suara Indonesia di pengaturan perangkat atau gunakan browser yang mendukungnya.')
      return
    }
    let index = 0
    const next = () => {
      if (disposed || current !== version) return
      if (index >= chunks.length) {
        activeUtterance = null
        update({ active: false, energy: 0 })
        onSpeaking(false)
        return
      }
      const text = chunks[index++]
      const utterance = new Utterance(text)
      activeUtterance = utterance // Retain while native synthesis owns the callbacks.
      utterance.lang = 'id-ID'
      if (voice) utterance.voice = voice
      utterance.rate = text.endsWith('?') ? 1.06 : text.length > 170 ? 1.1 : 1.08
      utterance.pitch = 1.02
      utterance.volume = 1
      const valid = () => !disposed && current === version && activeUtterance === utterance
      utterance.onstart = () => {
        if (!valid()) return
        update({ active: true, startedAt: now(), boundaryAt: now(), boundarySupported: false, energy: .65 })
        onSpeaking(true)
      }
      utterance.onboundary = event => {
        if (!valid() || (event.name && event.name !== 'word')) return
        const word = text.slice(event.charIndex || 0).match(/^\S+/)?.[0] || ''
        update({ active: true, boundaryAt: now(), boundarySupported: true, energy: Math.min(1, .45 + word.length * .055) })
      }
      utterance.onpause = () => { if (valid()) update({ active: false, energy: 0 }) }
      utterance.onresume = () => { if (valid()) update({ active: true, boundaryAt: now(), energy: .6 }) }
      utterance.onend = () => {
        if (!valid()) return
        update({ active: false, energy: 0 })
        next()
      }
      utterance.onerror = event => {
        if (!valid()) return
        stop()
        if (['canceled', 'interrupted'].includes(event.error)) return
        onError(event.error === 'not-allowed'
          ? 'Browser belum mengizinkan suara. Tekan Dengarkan untuk memulai pembacaan.'
          : ['language-unavailable', 'voice-unavailable'].includes(event.error)
            ? 'Suara bahasa Indonesia belum tersedia di perangkat ini.'
            : 'Pembacaan suara terhenti. Periksa keluaran audio atau koneksi suara, lalu tekan Dengarkan lagi.')
      }
      try { synthesis.speak(utterance) } catch {
        if (!valid()) return
        stop()
        onError('Pembacaan suara belum dapat dimulai. Tekan Dengarkan untuk mencoba kembali.')
      }
    }
    next()
  }
  const voicesChanged = () => {
    refreshVoices()
    if (!pending || !voices.length) return
    const { chunks, current } = pending
    pending = null
    if (timer !== null) clearTimer(timer)
    timer = null
    run(chunks, current)
  }
  refreshVoices()
  synthesis?.addEventListener?.('voiceschanged', voicesChanged)
  return {
    speak(text) {
      if (disposed) return
      stop()
      if (!synthesis || !Utterance) { onError('Pembacaan suara belum tersedia di browser ini.'); return }
      const chunks = splitNusaSpeech(text)
      if (!chunks.length) return
      const current = version
      refreshVoices()
      if (voices.length) { run(chunks, current); return }
      // Chrome can populate voices after mount. A short bounded wait prevents
      // choosing the wrong language on the very first spoken response.
      pending = { chunks, current }
      timer = setTimer(() => {
        timer = null
        if (!pending || current !== version || disposed) return
        pending = null
        refreshVoices()
        run(chunks, current)
      }, 350)
    },
    stop,
    dispose() {
      stop()
      disposed = true
      synthesis?.removeEventListener?.('voiceschanged', voicesChanged)
    },
  }
}
