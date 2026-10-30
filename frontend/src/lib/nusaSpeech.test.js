import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanNusaSpeech, createNusaSpeech, selectNusaVoice, splitNusaSpeech } from './nusaSpeech.js'

const indonesian = { name: 'Google Bahasa Indonesia', lang: 'id-ID' }

function setup(initialVoices = [indonesian]) {
  let voices = initialVoices
  let time = 100
  const utterances = [], states = [], errors = [], timers = new Map(), listeners = new Map()
  const activity = { current: {} }
  const synthesis = {
    getVoices: () => voices,
    speak: utterance => utterances.push(utterance),
    cancel: () => { utterances.at(-1)?.onend?.() },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
  }
  class Utterance { constructor(text) { this.text = text } }
  const controller = createNusaSpeech({
    synthesis, Utterance, activity, now: () => time,
    onSpeaking: value => states.push(value), onError: value => errors.push(value),
    setTimer: callback => { const id = Symbol(); timers.set(id, callback); return id },
    clearTimer: id => timers.delete(id),
  })
  return {
    controller, utterances, states, errors, timers, listeners, activity,
    setTime: value => { time = value },
    loadVoices: value => { voices = value; listeners.get('voiceschanged')?.() },
    fireTimers: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()) },
  }
}

test('speech cleans formatting without reading URLs or decorative emoji', () => {
  assert.equal(cleanNusaSpeech('## Halo 🌿\n**Ke Bali** bersama [Nusa](https://example.com).\n• Bawa air. https://example.com'), 'Halo. Ke Bali bersama Nusa. Bawa air.')
})

test('voice selection ranks natural Indonesian and never selects an unrelated language', () => {
  const neural = { name: 'Microsoft Gadis Natural', lang: 'id-ID' }
  assert.equal(selectNusaVoice([{ name: 'Natural English', lang: 'en-US', default: true }, indonesian, neural]), neural)
  assert.equal(selectNusaVoice([{ name: 'English', lang: 'en-US' }]), null)
  assert.equal(selectNusaVoice([{ name: 'Indonesia', lang: 'id_ID' }]).lang, 'id_ID')
})

test('long travel responses are split at punctuation or words without losing the ending', () => {
  const text = Array.from({ length: 80 }, (_, i) => `Hari ${i + 1}: jelajahi Bali, lalu istirahat.`).join(' ') + ' Sampai jumpa!'
  const chunks = splitNusaSpeech(text)
  assert.ok(chunks.length > 10)
  assert.ok(chunks.every(chunk => chunk.length <= 220))
  assert.equal(chunks.join(' '), text)
  assert.ok(chunks.at(-1).endsWith('Sampai jumpa!'))
})

test('late voice loading starts once with an Indonesian voice and clears the fallback timer', () => {
  const h = setup([])
  h.controller.speak('Halo, aku Nusa.')
  assert.equal(h.utterances.length, 0)
  h.loadVoices([indonesian])
  assert.equal(h.utterances.length, 1)
  assert.equal(h.utterances[0].voice, indonesian)
  assert.equal(h.timers.size, 0)
  h.fireTimers()
  assert.equal(h.utterances.length, 1)
})

test('missing voice inventory has a bounded wait and retains the Indonesian language hint', () => {
  const h = setup([])
  h.controller.speak('Selamat datang.')
  h.fireTimers()
  assert.equal(h.utterances.length, 1)
  assert.equal(h.utterances[0].lang, 'id-ID')
  assert.equal(h.utterances[0].voice, undefined)
})

test('unavailable Indonesian voice gives an actionable notice instead of reading English', () => {
  const h = setup([{ name: 'English', lang: 'en-US' }])
  h.controller.speak('Halo, aku Nusa.')
  assert.equal(h.utterances.length, 0)
  assert.match(h.errors[0], /suara Indonesia/i)
})

test('avatar speech activity follows real start, word boundary, pause and end events', () => {
  const h = setup()
  h.controller.speak('Halo, aku Nusa.')
  const first = h.utterances[0]
  assert.equal(h.activity.current.active, false)
  assert.ok(first.rate >= 1.06 && first.rate <= 1.1)
  first.onstart()
  assert.equal(h.activity.current.active, true)
  assert.equal(h.activity.current.startedAt, 100)
  assert.equal(h.activity.current.boundarySupported, false)
  h.setTime(180)
  first.onboundary({ name: 'word', charIndex: 6 })
  assert.equal(h.activity.current.boundarySupported, true)
  assert.equal(h.activity.current.boundaryAt, 180)
  assert.ok(h.activity.current.energy > 0)
  first.onpause()
  assert.equal(h.activity.current.active, false)
  first.onresume()
  assert.equal(h.activity.current.active, true)
  first.onend()
  assert.equal(h.activity.current.active, false)
  assert.equal(h.activity.current.energy, 0)
  assert.equal(h.states.at(-1), false)
})

test('stop invalidates native callbacks before cancellation and never continues the old response', () => {
  const h = setup()
  h.controller.speak('Perjalanan yang hangat dan penuh cerita. '.repeat(30))
  const stale = h.utterances[0]
  stale.onstart()
  h.controller.stop()
  const count = h.utterances.length
  stale.onstart()
  stale.onboundary({ name: 'word', charIndex: 0 })
  stale.onend()
  stale.onerror({ error: 'network' })
  assert.equal(h.utterances.length, count)
  assert.equal(h.activity.current.active, false)
  assert.equal(h.states.at(-1), false)
  assert.deepEqual(h.errors, [])
  h.controller.speak('Jawaban baru.')
  assert.equal(h.utterances.at(-1).text, 'Jawaban baru.')
})

test('chunks continue directly through the final sentence without artificial pause timers', () => {
  const h = setup()
  const text = 'Jelajahi pantai, budaya, dan kuliner lokal. '.repeat(20).trim() + ' Sampai jumpa!'
  h.controller.speak(text)
  let finished = 0
  while (finished < h.utterances.length) {
    const utterance = h.utterances[finished++]
    utterance.onstart()
    utterance.onend()
    assert.ok(finished < 100)
  }
  assert.ok(h.utterances.length > 1)
  assert.equal(h.utterances.map(utterance => utterance.text).join(' '), text)
  assert.equal(h.timers.size, 0)
  assert.equal(h.states.at(-1), false)
})

test('dispose cancels waiting work and unregisters the voice listener', () => {
  const h = setup([])
  h.controller.speak('Belum dimulai.')
  h.controller.dispose()
  assert.equal(h.timers.size, 0)
  assert.equal(h.listeners.size, 0)
  h.loadVoices([indonesian])
  h.fireTimers()
  h.controller.speak('Sudah ditutup.')
  assert.equal(h.utterances.length, 0)
})

test('an actual synthesis error closes the mouth and does not queue remaining chunks', () => {
  const h = setup()
  h.controller.speak('Jelajahi pantai, budaya, dan kuliner lokal. '.repeat(20))
  h.utterances[0].onstart()
  h.utterances[0].onerror({ error: 'network' })
  assert.equal(h.utterances.length, 1)
  assert.equal(h.activity.current.active, false)
  assert.equal(h.states.at(-1), false)
  assert.match(h.errors[0], /terhenti/)
})
