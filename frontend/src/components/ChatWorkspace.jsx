import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, AudioLines, Camera, Check, ChevronDown, ChevronRight, Compass, Copy, FileAudio, FileVideo, Headphones, Image, Leaf, LoaderCircle, LogOut, Menu, MessageCircle, Mic, MicOff, Mountain, Paperclip, Plus, Route, Settings2, ShieldCheck, Square, Sun, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import AvatarCanvas from './AvatarCanvas'
import CameraCapture from './CameraCapture'
import { MobileCallDock, MobileCallStage } from './MobileCall'
import NusaMark from './NusaMark'
import ErrorBoundary from './ErrorBoundary'
import { CHAT_PROMPTS } from '../lib/chatPrompts'
import { createNusaSpeech } from '../lib/nusaSpeech'
import { createChatResponseError } from '../lib/chatErrors'
import { ATTACHMENT_ACCEPT, DEFAULT_UPLOAD_LIMITS, formatFileSize, getAccountScope, getInitialBackendUrl, getModelDisplayName, getReplyModelInfo, getServiceKey, getUploadLimits, hydrateSession, isSessionVisible, mergeRemoteSessions, normalizeBackendUrl, restoreAccount, restoreSessions, serializeSessions, toServerAttachment, validateAttachmentFiles } from '../lib/chatData'
import './ChatWorkspace.css'
import './ChatWorkspaceTheme.css'

const STORAGE_KEY = 'nusa_chat_v1'
const CONFIG_KEY = 'nusa_config_v1'
const AUTH_KEY = 'nusa_account_v2'
const DEFAULT_BACKEND_URL = import.meta.env.VITE_API_URL?.trim() || '/api'
const PROVIDER_SETUP_MESSAGE = 'Layanan AI belum diaktifkan oleh pengelola. Coba kembali setelah layanan siap.'
const uid = () => globalThis.crypto?.randomUUID?.() || `nusa-${Date.now()}-${Math.random().toString(36).slice(2)}`
const makeSession = accountScope => ({ id: uid(), title: 'Petualangan baru', mode: 'live', accountScope, messages: [], updated: Date.now() })
const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* History remains available for the current visit. */ } }
const clearStoredAccount = () => { try { localStorage.removeItem(AUTH_KEY); localStorage.removeItem('sanctum_token'); localStorage.removeItem('user_data') } catch {} }
const ICONS = { sun: Sun, compass: Compass, mountain: Mountain, route: Route }

function ServiceNotice({ title, message, checking = false, children }) {
  return <details className={`chat-service-status ${checking ? 'is-checking' : ''}`}>
    <summary><span className="chat-service-indicator"/><strong aria-live="polite">{title}</strong><ChevronDown size={16}/></summary>
    <div className="chat-service-detail"><p>{message}</p>{children && <div className="chat-service-actions">{children}</div>}</div>
  </details>
}

function loadHistory() {
  const data = readStorage(STORAGE_KEY, [])
  return restoreSessions(data)
}

function AttachmentList({ attachments, uploadState, onRefresh, refreshing }) {
  const [failedUrls, setFailedUrls] = useState([])
  if (!attachments?.length) return null
  return <div className="chat-message-attachments">{attachments.map(attachment => {
    const Icon = attachment.type?.startsWith('audio/') ? FileAudio : attachment.type?.startsWith('video/') ? FileVideo : Image
    const source = attachment.previewUrl || attachment.url
    const expired = source && !source.startsWith('blob:') && Number(new URL(source).searchParams.get('expires')) <= Date.now() / 1000
    const unavailable = !source || failedUrls.includes(source) || expired
    return <div className="chat-message-file" key={attachment.id || attachment.name}>{attachment.type?.startsWith('image/') && source && !unavailable && <img src={source} alt={attachment.name} loading="lazy" onError={() => setFailedUrls(prev => [...prev, source])}/>}<div><Icon size={16}/><span><strong>{attachment.name}</strong><small>{formatFileSize(attachment.size)}{uploadState === 'sending' ? ' · Mengirim…' : uploadState === 'failed' ? ' · Belum berhasil dikirim' : uploadState === 'canceled' || uploadState === 'interrupted' ? ' · Pengiriman terhenti' : ''}</small>{source && !unavailable && !source.startsWith('blob:') && <a href={source} target="_blank" rel="noopener noreferrer" onClick={event => { if (Number(new URL(source).searchParams.get('expires')) <= Date.now() / 1000) { event.preventDefault(); setFailedUrls(prev => [...prev, source]); onRefresh?.() } }}>Buka lampiran</a>}{unavailable && uploadState !== 'failed' && uploadState !== 'canceled' && uploadState !== 'interrupted' && <button type="button" disabled={refreshing} onClick={() => { setFailedUrls([]); onRefresh?.() }}>{refreshing ? 'Memperbarui…' : 'Perbarui tautan lampiran'}</button>}</span></div></div>
  })}</div>
}

function MessageContent({ text }) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part)
    return <span className={`chat-text-line${line.startsWith('•') ? ' chat-text-bullet' : ''}`} key={i}>{parts.length ? parts : '\u00a0'}</span>
  })
}

export default function ChatWorkspace({ onBack, initialPrompt = '' }) {
  const [sessions, setSessions] = useState(loadHistory)
  const [activeId, setActiveId] = useState(() => readStorage(STORAGE_KEY, [])?.[0]?.id || null)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [status, setStatus] = useState('idle')
  const [speaking, setSpeaking] = useState(false)
  const [voice, setVoice] = useState(false)
  const [listening, setListening] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [settings, setSettings] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const [copied, setCopied] = useState(null)
  const [config, setConfig] = useState(() => {
    const saved = readStorage(CONFIG_KEY, {})
    return { backendUrl: getInitialBackendUrl(saved.backendUrl, DEFAULT_BACKEND_URL) }
  })
  const [savedAccount] = useState(() => restoreAccount(readStorage(AUTH_KEY, null), config.backendUrl))
  const [token, setToken] = useState(savedAccount?.token || '')
  const [user, setUser] = useState(savedAccount?.user || null)
  const [backendDraft, setBackendDraft] = useState(config.backendUrl)
  const [connectionError, setConnectionError] = useState('')
  const [historyState, setHistoryState] = useState('idle')
  const [connection, setConnection] = useState(savedAccount ? 'checking' : 'signed-out')
  const [provider, setProvider] = useState({ state: 'checking', message: 'Memeriksa layanan AI…' })
  const [uploadLimits, setUploadLimits] = useState(DEFAULT_UPLOAD_LIMITS)
  const [verifiedScope, setVerifiedScope] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [greeting, setGreeting] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width:1050px)').matches)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const bottomRef = useRef(null)
  const mainRef = useRef(null)
  const composeAreaRef = useRef(null)
  const conversationRef = useRef(null)
  const inputRef = useRef(null)
  const settingsRef = useRef(null)
  const sidebarRef = useRef(null)
  const settingsOpenerRef = useRef(null)
  const sidebarOpenerRef = useRef(null)
  const fileInputRef = useRef(null)
  const attachmentsRef = useRef([])
  const objectUrlsRef = useRef(new Set())
  const requestRef = useRef({ version: 0, controller: null, timer: null, interval: null, upload: null })
  const recognitionRef = useRef(null)
  const mountedRef = useRef(true)
  const initialRef = useRef(false)
  const lastPromptRef = useRef('')
  const lastMessageRef = useRef(null)
  const speechControllerRef = useRef(null)
  const speechActivityRef = useRef({ active: false, startedAt: 0, boundaryAt: 0, boundarySupported: false, energy: 0 })
  const accountVersionRef = useRef(0)
  const authRequestRef = useRef(null)
  const sessionsRef = useRef(sessions)
  const activeWorkRef = useRef(null)
  const deletedSessionsRef = useRef(new Set())
  const backendUrl = config.backendUrl === '/' ? window.location.origin : config.backendUrl.replace(/\/+$/, '')
  const remoteReady = Boolean(token && connection === 'live' && verifiedScope && verifiedScope === getAccountScope(user, backendUrl))
  const aiReady = remoteReady && provider.state === 'configured'
  const uploadsEnabled = uploadLimits.max_attachment_count > 0 && uploadLimits.max_attachment_bytes > 0 && uploadLimits.max_total_attachment_bytes > 0
  const accountScope = remoteReady ? verifiedScope : null
  const visibleSessions = sessions.filter(session => isSessionVisible(session, accountScope)).sort((a, b) => b.updated - a.updated)
  const active = visibleSessions.find(s => s.id === activeId) || visibleSessions[0]
  const messages = active?.messages || []
  const busy = status !== 'idle'
  useEffect(() => { activeWorkRef.current = busy ? active?.id : null }, [active?.id, busy])
  const latestContent = messages[messages.length - 1]?.content
  const avatarStatus = listening ? 'Aku mendengarkanmu' : status === 'thinking' ? 'Sebentar, aku pikirkan…' : status === 'responding' || speaking ? 'Aku punya cerita untukmu' : 'Siap menemani jelajahmu'
  const openSettings = useCallback(() => { settingsOpenerRef.current = document.activeElement; setSettings(true) }, [])
  const openSidebar = () => { sidebarOpenerRef.current = document.activeElement; setSidebar(true) }

  useEffect(() => {
    const main = mainRef.current, composer = composeAreaRef.current
    if (!main || !composer) return
    const measure = () => main.style.setProperty('--chat-compose-height', `${Math.ceil(composer.getBoundingClientRect().height)}px`)
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(composer)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [isMobile])

  useEffect(() => {
    if (!isMobile || !mobileChatOpen || settings || cameraOpen) return
    const previous = document.activeElement
    conversationRef.current?.focus({ preventScroll: true })
    const keydown = event => { if (event.key === 'Escape') setMobileChatOpen(false) }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus?.() }
  }, [isMobile, mobileChatOpen, settings, cameraOpen])

  const releaseFiles = useCallback(files => {
    files.forEach(item => {
      if (item.previewUrl && objectUrlsRef.current.has(item.previewUrl)) {
        URL.revokeObjectURL(item.previewUrl)
        objectUrlsRef.current.delete(item.previewUrl)
      }
    })
  }, [])
  const clearAttachments = useCallback(() => {
    releaseFiles(attachmentsRef.current)
    attachmentsRef.current = []
    if (mountedRef.current) setAttachments([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [releaseFiles])
  const cancelWork = useCallback((update = true) => {
    const request = requestRef.current
    request.version += 1
    request.pending = false
    request.controller?.abort()
    clearTimeout(request.timer)
    clearInterval(request.interval)
    if (request.upload) {
      const { sessionId, sessionScope, messageId, files } = request.upload
      releaseFiles(files)
      if (update && mountedRef.current) setSessions(prev => prev.map(session => session.id === sessionId && session.accountScope === sessionScope ? { ...session, messages: session.messages.map(message => message.id === messageId ? { ...message, uploadState: 'canceled', attachments: message.attachments?.map(({ previewUrl: _preview, ...attachment }) => attachment) } : message) } : session))
      request.upload = null
    }
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
    speechControllerRef.current?.stop()
    if (update && mountedRef.current) { setStatus('idle'); setSpeaking(false); setListening(false); setCanRetry(false) }
  }, [releaseFiles])

  useEffect(() => {
    mountedRef.current = true
    const speech = createNusaSpeech({
      synthesis: globalThis.speechSynthesis,
      Utterance: globalThis.SpeechSynthesisUtterance,
      activity: speechActivityRef,
      onSpeaking: value => { if (mountedRef.current) setSpeaking(value) },
      onError: message => { if (mountedRef.current) setNotice(message) },
    })
    speechControllerRef.current = speech
    const ownedUrls = objectUrlsRef.current
    return () => { mountedRef.current = false; authRequestRef.current?.abort(); cancelWork(false); speech.dispose(); speechControllerRef.current = null; releaseFiles([...ownedUrls].map(previewUrl => ({ previewUrl }))) }
  }, [cancelWork, releaseFiles])
  useEffect(() => {
    sessionsRef.current = sessions
    const timer = setTimeout(() => writeStorage(STORAGE_KEY, serializeSessions(sessions)), 300)
    return () => clearTimeout(timer)
  }, [sessions])
  useEffect(() => {
    const flush = () => writeStorage(STORAGE_KEY, serializeSessions(sessionsRef.current))
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [])
  useEffect(() => { writeStorage(CONFIG_KEY, config) }, [config])
  useEffect(() => {
    // Credentials from older versions were not tied to a service. Require a
    // fresh login instead of sending an unscoped token to a configured address.
    try { localStorage.removeItem('sanctum_token'); localStorage.removeItem('user_data') } catch {}
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(max-width:1050px)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: status === 'responding' ? 'instant' : 'smooth', block: 'nearest' })
  }, [messages.length, latestContent, status, mobileChatOpen])
  useEffect(() => {
    const controller = new AbortController()
    setProvider({ state: 'checking', message: 'Memeriksa layanan AI…' })
    setUploadLimits(DEFAULT_UPLOAD_LIMITS)
    fetch(`${backendUrl}/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable')
        const data = await response.json()
        if (typeof data.configured !== 'boolean') throw new Error('invalid-status')
        if (!controller.signal.aborted) {
          setUploadLimits(getUploadLimits(data.upload_limits))
          setProvider(data.configured
            ? { state: 'configured', message: 'Layanan AI siap dicoba. Jawaban memerlukan koneksi ke penyedia AI.' }
            : { state: 'missing', message: PROVIDER_SETUP_MESSAGE })
        }
      }).catch(() => {
        if (!controller.signal.aborted) setProvider({ state: 'offline', message: 'Layanan AI belum dapat dihubungi. Periksa koneksi lalu coba kembali; pesanmu belum dikirim.' })
      })
    return () => controller.abort()
  }, [backendUrl, connectionAttempt])
  useEffect(() => {
    if (!token) { setConnection('signed-out'); setVerifiedScope(null); return }
    const controller = new AbortController()
    const version = accountVersionRef.current
    setConnection('checking')
    fetch(`${backendUrl}/user`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'expired' : 'offline')
        const account = await response.json()
        const scope = getAccountScope(account, backendUrl)
        if (!scope || typeof account.name !== 'string' || typeof account.email !== 'string') throw new Error('invalid-account')
        if (!controller.signal.aborted && version === accountVersionRef.current) { setUser(account); writeStorage(AUTH_KEY, { token, user: account, service: getServiceKey(backendUrl) }); setVerifiedScope(scope); setConnection('live') }
      }).catch(error => {
        if (controller.signal.aborted || version !== accountVersionRef.current) return
        setConnection('offline')
        setVerifiedScope(null)
        if (error.message === 'expired') {
          cancelWork(); clearAttachments(); accountVersionRef.current += 1
          setToken(''); setUser(null)
          clearStoredAccount()
          setNotice('Sesi masukmu sudah berakhir. Masuk kembali untuk melanjutkan percakapan AI.')
        }
      })
    return () => controller.abort()
  }, [backendUrl, token, connectionAttempt, cancelWork, clearAttachments])
  useEffect(() => {
    if (!remoteReady) { setHistoryState('idle'); return }
    const controller = new AbortController()
    const version = accountVersionRef.current
    const valid = () => !controller.signal.aborted && mountedRef.current && version === accountVersionRef.current
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
    const read = async path => {
      const response = await fetch(`${backendUrl}${path}`, { headers, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      if (!response.ok) throw new Error('history-unavailable')
      return response.json()
    }
    setHistoryState('loading')
    ;(async () => {
      try {
        const remote = await read('/chat/sessions')
        if (!Array.isArray(remote)) throw new Error('invalid-history')
        // Limit concurrency without silently hiding sessions beyond the first 15.
        const hydrated = []
        let failed = false
        for (let offset = 0; offset < remote.length; offset += 4) {
          if (!valid()) return
          const batch = await Promise.allSettled(remote.slice(offset, offset + 4).map(async session => {
            if (!session || !['string', 'number'].includes(typeof session.id)) throw new Error('invalid-session')
            const result = hydrateSession(session, await read(`/chat/sessions/${encodeURIComponent(session.id)}/messages`), accountScope, backendUrl)
            if (!result) throw new Error('invalid-history')
            return result
          }))
          batch.forEach(result => { if (result.status === 'fulfilled') hydrated.push(result.value); else failed = true })
        }
        if (!valid()) return
        setSessions(prev => mergeRemoteSessions(prev, hydrated.filter(session => !deletedSessionsRef.current.has(`${session.accountScope}::${session.id}`)), activeWorkRef.current))
        setHistoryState(failed ? 'error' : 'ready')
      } catch { if (valid()) setHistoryState('error') }
    })()
    return () => controller.abort()
  }, [accountScope, backendUrl, connectionAttempt, remoteReady, token])
  useEffect(() => {
    if (!sidebar || !isMobile || settings) return
    const dialog = sidebarRef.current
    const previous = sidebarOpenerRef.current || document.activeElement
    dialog?.querySelector('button')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') setSidebar(false)
      if (event.key !== 'Tab') return
      const nodes = [...dialog.querySelectorAll('button:not(:disabled), a[href]')].filter(node => node.getClientRects().length)
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus?.() }
  }, [isMobile, settings, sidebar])
  useEffect(() => {
    if (!settings) return
    const dialog = settingsRef.current
    const previous = settingsOpenerRef.current || document.activeElement
    dialog?.querySelector('button, input')?.focus()
    const keydown = event => {
      if (event.key === 'Escape') setSettings(false)
      if (event.key === 'Tab' && dialog) {
        const nodes = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea, a[href], summary')].filter(node => node.getClientRects().length)
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus?.() }
  }, [settings])

  const speak = useCallback(text => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.abort()
    setListening(false)
    speechControllerRef.current?.speak(text)
  }, [])

  const sendMessage = useCallback(async (text, retry = false, onAccepted) => {
    const prompt = text.trim()
    const files = attachmentsRef.current
    if ((!prompt && !files.length) || status !== 'idle' || requestRef.current.pending) return
    if (!remoteReady) {
      setInput(prompt)
      setNotice(token ? 'Akun belum terhubung. Periksa koneksi akun untuk mengirim pesan ke AI.' : 'Masuk atau buat akun untuk mengobrol dengan Nusa. Pesan dan lampiranmu tetap ada di sini.')
      openSettings()
      return
    }
    if (provider.state !== 'configured') { setInput(prompt); setNotice(provider.message); return }
    cancelWork()
    let session = active
    if (!session) { session = makeSession(accountScope); setSessions(prev => [session, ...prev]); setActiveId(session.id) }
    const attachmentError = validateAttachmentFiles(files.map(item => item.file), [], uploadLimits)
    if (attachmentError) { setNotice(attachmentError); return }
    // Guard rapid Enter/clicks before React has rendered the thinking state.
    requestRef.current.pending = true
    const sessionId = session.id
    const sessionScope = session.accountScope
    const retryMessageId = retry && lastMessageRef.current?.sessionId === sessionId ? lastMessageRef.current.messageId : null
    const messageId = retryMessageId || uid()
    const attachmentMetadata = files.map(item => ({ id: item.id, name: item.file.name, type: item.file.type, size: item.file.size, previewUrl: item.previewUrl }))
    lastMessageRef.current = { sessionId, messageId }
    const version = requestRef.current.version
    const controller = new AbortController()
    requestRef.current.controller = controller
    requestRef.current.upload = files.length ? { sessionId, sessionScope, messageId, files } : null
    lastPromptRef.current = prompt
    attachmentsRef.current = []
    setAttachments([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setInput(''); setNotice(''); setListening(false); setStatus('thinking')
    recognitionRef.current?.abort()
    setSessions(prev => prev.map(s => s.id === sessionId && s.accountScope === sessionScope ? { ...s, title: s.messages.length ? s.title : (prompt || files[0]?.file.name || 'Unggahan perjalanan').slice(0, 42), updated: Date.now(), messages: retryMessageId ? s.messages.map(message => message.id === messageId ? { ...message, content: prompt, attachments: attachmentMetadata, uploadState: files.length ? 'sending' : undefined } : message) : [...s.messages, { id: messageId, role: 'user', content: prompt, attachments: attachmentMetadata, uploadState: files.length ? 'sending' : undefined }] } : s))
    onAccepted?.()
    const valid = () => mountedRef.current && requestRef.current.version === version && !controller.signal.aborted
    const finishFiles = (state, uploaded = []) => {
      requestRef.current.upload = null
      const metadata = state === 'sent' ? (Array.isArray(uploaded) ? uploaded : []).map(item => toServerAttachment(item, backendUrl)) : attachmentMetadata.map(({ previewUrl: _preview, ...attachment }) => attachment)
      setSessions(prev => prev.map(s => s.id === sessionId && s.accountScope === sessionScope ? { ...s, messages: s.messages.map(message => message.id === messageId ? { ...message, attachments: metadata.length ? metadata : attachmentMetadata.map(({ previewUrl: _preview, ...attachment }) => attachment), uploadState: state } : message) } : s))
      if (state === 'failed') { attachmentsRef.current = files; setAttachments(files) }
      else releaseFiles(files)
    }
    const reveal = (responseText, modelInfo = {}) => {
      if (!valid()) return
      setStatus('responding')
      const messageId = uid()
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setSessions(prev => prev.map(s => s.id === sessionId && s.accountScope === sessionScope ? { ...s, messages: [...s.messages, { id: messageId, role: 'assistant', content: reduced ? responseText : '', ...modelInfo }] } : s))
      if (voice) speak(responseText)
      if (reduced) { requestRef.current.pending = false; setStatus('idle'); return }
      let length = 0
      const chunk = Math.max(8, Math.ceil(responseText.length / 45))
      requestRef.current.interval = setInterval(() => {
        if (!valid()) { clearInterval(requestRef.current.interval); return }
        length = Math.min(responseText.length, length + chunk)
        setSessions(prev => prev.map(s => s.id === sessionId && s.accountScope === sessionScope ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, content: responseText.slice(0, length) } : m) } : s))
        if (length === responseText.length) { clearInterval(requestRef.current.interval); requestRef.current.pending = false; setStatus('idle') }
      }, 16)
    }
    requestRef.current.timer = setTimeout(() => {
      if (valid()) { finishFiles('failed'); controller.abort(); requestRef.current.pending = false; setStatus('idle'); setCanRetry(true); setNotice('Layanan AI memerlukan waktu lebih lama. Coba kirim lagi sebentar.'); }
    }, 65000)
    try {
      const body = new FormData()
      body.append('message', prompt)
      files.forEach((item, index) => body.append(`attachments[${index}]`, item.file, item.file.name))
      const response = await fetch(`${backendUrl}/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body, signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!valid()) return
      if (!response.ok) {
        const error = createChatResponseError(response, data, PROVIDER_SETUP_MESSAGE)
        if (['AI_NOT_CONFIGURED', 'AI_AUTH_FAILED', 'AI_TLS_ERROR', 'AI_MODEL_UNAVAILABLE', 'AI_MODEL_CONFIGURATION'].includes(data.code)) {
          setProvider({ state: 'blocked', message: data.code === 'AI_NOT_CONFIGURED' ? PROVIDER_SETUP_MESSAGE : error.message })
        }
        throw error
      }
      if (typeof data.ai_message?.content !== 'string') throw new Error('Jawaban tidak dapat dibaca. Coba kirim lagi.')
      if (!valid()) return
      clearTimeout(requestRef.current.timer)
      finishFiles('sent', data.user_message?.attachments || [])
      const modelInfo = getReplyModelInfo(data.ai_message)
      if (modelInfo.fallbackUsed) setNotice(`Model utama sedang belum tersedia. Jawaban ini menggunakan model cadangan ${getModelDisplayName(modelInfo.model)}.`)
      reveal(data.ai_message.content, modelInfo)
    } catch (error) {
      clearTimeout(requestRef.current.timer)
      if (valid()) {
        requestRef.current.pending = false
        finishFiles(error.authExpired ? 'canceled' : 'failed'); setStatus('idle'); setNotice(error.message === 'Failed to fetch' ? 'Koneksi ke layanan terputus. Periksa koneksi lalu coba kirim kembali.' : error.message); setCanRetry(error.retryable !== false)
        if (error.authExpired) {
          setVerifiedScope(null); setConnection('signed-out'); setToken(''); setUser(null); accountVersionRef.current += 1
          clearStoredAccount()
          clearAttachments()
        }
      }
    }
  }, [accountScope, active, backendUrl, cancelWork, clearAttachments, openSettings, provider, releaseFiles, remoteReady, speak, status, token, uploadLimits, voice])

  useEffect(() => {
    const prompt = initialPrompt.trim()
    if (!prompt || initialRef.current) return
    if (token && (connection === 'checking' || provider.state === 'checking')) return
    if (!remoteReady) {
      initialRef.current = 'retained'
      setInput(prompt)
      setNotice(token ? 'Akun belum dapat dihubungkan. Ide perjalananmu tetap ada di kotak pesan.' : 'Ide perjalananmu sudah siap. Masuk atau buat akun, lalu kirim untuk mulai mengobrol.')
      return
    }
    initialRef.current = 'preparing'
    // Create a dedicated session after authentication resolves. The ref prevents StrictMode duplicates.
    queueMicrotask(() => {
      if (!mountedRef.current) return
      cancelWork(); clearAttachments()
      const session = makeSession(accountScope)
      initialRef.current = session.id
      setSessions(prev => [session, ...prev]); setActiveId(session.id)
    })
  }, [accountScope, cancelWork, clearAttachments, connection, initialPrompt, provider.state, remoteReady, token])
  useEffect(() => {
    const prompt = initialPrompt.trim()
    if (!prompt || initialRef.current !== active?.id) return
    if (provider.state === 'checking') return
    if (!remoteReady || provider.state !== 'configured') {
      initialRef.current = 'retained'
      setInput(prompt)
      setNotice(`${provider.message} Ide perjalananmu tetap ada di kotak pesan dan belum dikirim.`)
      return
    }
    if (status !== 'idle') return
    initialRef.current = 'dispatching'
    queueMicrotask(() => {
      if (!mountedRef.current) return
      sendMessage(prompt, false, () => { initialRef.current = 'sent' }).then(() => {
        if (mountedRef.current && initialRef.current === 'dispatching') {
          initialRef.current = 'retained'
          setInput(prompt)
          setNotice('Ide perjalananmu tetap ada di kotak pesan dan belum dikirim. Periksa kesiapan akun serta layanan, lalu kirim kembali.')
        }
      })
    })
  }, [active, initialPrompt, provider, remoteReady, sendMessage, status])

  function newSession() {
    if (!remoteReady) { openSettings(); return }
    cancelWork(); clearAttachments()
    lastMessageRef.current = null; lastPromptRef.current = ''
    const session = makeSession(accountScope)
    setMobileChatOpen(false)
    setSessions(prev => [session, ...prev]); setActiveId(session.id); setSidebar(false); setNotice(''); setInput(''); setGreeting(v => v + 1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  function selectSession(id) { if (!visibleSessions.some(session => session.id === id)) return; cancelWork(); clearAttachments(); lastMessageRef.current = null; lastPromptRef.current = ''; setActiveId(id); setSidebar(false); setMobileChatOpen(true); setNotice(''); setInput('') }
  async function removeSession(id) {
    const removed = visibleSessions.find(s => s.id === id)
    if (!removed) return
    const version = accountVersionRef.current
    if (id === active?.id) cancelWork()
    if (removed?.mode === 'live' && remoteReady && removed.messages.length) {
      try {
        const response = await fetch(`${backendUrl}/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
        if (!response.ok && response.status !== 404) throw new Error()
      } catch { if (mountedRef.current && version === accountVersionRef.current) setNotice('Percakapan belum dapat dihapus dari layanan. Coba lagi setelah terhubung.'); return }
    }
    if (!mountedRef.current || version !== accountVersionRef.current) return
    deletedSessionsRef.current.add(`${removed.accountScope}::${id}`)
    if (id === active?.id) { clearAttachments(); setActiveId(null) }
    setSessions(prev => {
      const rest = prev.filter(s => s.id !== id || s.accountScope !== removed.accountScope)
      return rest
    })
  }
  async function copyMessage(message) {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => { if (mountedRef.current) setCopied(null) }, 1800) }
    catch { setNotice('Teks belum dapat disalin. Pilih teks jawaban dan salin secara manual.'); }
  }
  function addFiles(files) {
    if (!files.length) return ''
    const error = validateAttachmentFiles(files, attachmentsRef.current, uploadLimits)
    if (error) { setNotice(error); return error }
    const selected = files.map(file => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      if (previewUrl) objectUrlsRef.current.add(previewUrl)
      return { id: uid(), file, previewUrl }
    })
    const next = [...attachmentsRef.current, ...selected]
    attachmentsRef.current = next; setAttachments(next)
    setNotice(remoteReady ? '' : 'Lampiran siap. Masuk ke akun untuk mengirimkannya bersama pesanmu.')
    return ''
  }
  function selectFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    addFiles(files)
  }
  function attachCameraPhoto(file) {
    const error = addFiles([file])
    if (!error) { setCameraOpen(false); inputRef.current?.focus() }
    return error
  }
  function removeAttachment(id) {
    const removed = attachmentsRef.current.filter(item => item.id === id)
    releaseFiles(removed)
    const next = attachmentsRef.current.filter(item => item.id !== id)
    attachmentsRef.current = next; setAttachments(next)
  }
  function toggleVoice() {
    if (voice) speechControllerRef.current?.stop()
    setVoice(value => !value)
  }
  function toggleListening() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setNotice('Dikte suara belum didukung browser ini. Kamu tetap bisa mengetik pesan.'); return }
    speechControllerRef.current?.stop()
    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'id-ID'; recognition.interimResults = true; recognition.continuous = false
    let transcript = ''
    const current = () => mountedRef.current && recognitionRef.current === recognition
    recognition.onstart = () => { if (current()) { setListening(true); setNotice('') } }
    recognition.onresult = event => {
      transcript = Array.from(event.results).map(result => result[0].transcript).join(' ')
      if (current()) setInput(transcript)
    }
    recognition.onend = () => { if (current()) { recognitionRef.current = null; setListening(false); inputRef.current?.focus() } }
    recognition.onerror = event => {
      if (!current() || event.error === 'aborted') return
      recognitionRef.current = null
      setListening(false)
      setNotice(event.error === 'not-allowed' ? 'Akses mikrofon belum diizinkan. Izinkan di browser untuk memakai dikte.' : 'Suara belum tertangkap. Coba lagi atau ketik pesanmu.')
    }
    try { recognition.start() } catch { setNotice('Mikrofon belum dapat dimulai. Coba lagi.'); setListening(false) }
  }
  async function authenticate(event) {
    event.preventDefault(); setAuthBusy(true); setAuthError('')
    authRequestRef.current?.abort()
    const controller = new AbortController()
    authRequestRef.current = controller
    const version = accountVersionRef.current
    try {
      const response = await fetch(`${backendUrl}/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(authForm), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      const data = await response.json().catch(() => ({}))
      if (!mountedRef.current || controller.signal.aborted || version !== accountVersionRef.current) return
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat().join(' ') || data.message || 'Belum berhasil masuk. Periksa kembali datamu.')
      const newScope = getAccountScope(data.user, backendUrl)
      if (typeof data.token !== 'string' || !data.token || !newScope || typeof data.user.name !== 'string' || typeof data.user.email !== 'string') throw new Error('Data akun belum dapat dibaca.')
      cancelWork(); setToken(data.token); setUser(data.user); setConnection('live'); setVerifiedScope(newScope)
      accountVersionRef.current += 1
      writeStorage(AUTH_KEY, { token: data.token, user: data.user, service: getServiceKey(backendUrl) })
      const session = makeSession(newScope)
      setSessions(prev => [session, ...prev]); setActiveId(session.id); setSettings(false); setNotice(provider.state === 'configured' ? 'Akun terhubung. Kamu dapat mencoba percakapan AI sekarang.' : `Akun terhubung. ${provider.message}`); setAuthForm({ name: '', email: '', password: '', password_confirmation: '' })
    } catch (error) { if (mountedRef.current && !controller.signal.aborted && version === accountVersionRef.current) setAuthError(error.name === 'TimeoutError' ? 'Layanan belum terhubung. Periksa alamat layanan lalu coba lagi.' : error.message === 'Failed to fetch' ? 'Layanan belum dapat dihubungi. Periksa alamat layanan dan koneksi.' : error.message) }
    finally { if (mountedRef.current && authRequestRef.current === controller) setAuthBusy(false) }
  }
  function applyBackend(event) {
    event.preventDefault()
    let next
    try { next = normalizeBackendUrl(backendDraft) } catch (error) { setConnectionError(error.message); return }
    setConnectionError(''); setBackendDraft(next)
    if (getServiceKey(next) === getServiceKey(backendUrl)) { setConfig({ backendUrl: next }); return }
    authRequestRef.current?.abort(); setAuthBusy(false); cancelWork(); clearAttachments()
    accountVersionRef.current += 1
    clearStoredAccount(); setToken(''); setUser(null); setVerifiedScope(null); setConnection('signed-out'); setHistoryState('idle')
    setAuthForm({ name: '', email: '', password: '', password_confirmation: '' }); setAuthError('')
    setConfig({ backendUrl: next }); setNotice('Alamat layanan diperbarui. Masuk ke akun layanan ini untuk melanjutkan.')
    lastMessageRef.current = null; lastPromptRef.current = ''
  }
  async function logout() {
    cancelWork(); clearAttachments()
    accountVersionRef.current += 1
    const oldToken = token
    setToken(''); setUser(null); setConnection('signed-out'); setVerifiedScope(null)
    clearStoredAccount()
    setActiveId(null); setSettings(false); setInput('')
    try { await fetch(`${backendUrl}/logout`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${oldToken}` }, signal: AbortSignal.timeout(8000) }) } catch {}
  }

  return <div className={`chat-workspace ${messages.length ? 'is-conversing' : 'is-welcoming'} ${isMobile ? 'is-call-layout' : ''} ${mobileChatOpen ? 'is-chat-open' : ''}`}>
    {sidebar && <button className="chat-sidebar-overlay" aria-label="Tutup riwayat" inert={settings || cameraOpen} tabIndex={-1} onClick={() => setSidebar(false)} />}
    <aside ref={sidebarRef} className={`chat-sidebar ${sidebar ? 'is-open' : ''}`} inert={cameraOpen || settings || (isMobile && !sidebar)} role={isMobile && sidebar ? 'dialog' : undefined} aria-modal={isMobile && sidebar ? true : undefined} aria-label={isMobile && sidebar ? 'Riwayat percakapan' : undefined}>
      <div className="chat-sidebar-heading"><button className="chat-brand" onClick={() => { cancelWork(); onBack?.() }} aria-label="Kembali ke beranda"><span className="chat-logo"><NusaMark size={29}/></span> nusa<span className="chat-brand-ai">ai</span><span className="chat-brand-dot">.</span></button><button className="chat-mobile-close" aria-label="Tutup riwayat percakapan" onClick={() => setSidebar(false)}><X size={18}/></button></div>
      <button className="chat-new" onClick={() => newSession()}><Plus size={18}/> Percakapan baru <span>↗</span></button>
      <span className="chat-section-label">PERCAKAPAN TERAKHIR</span>
      <div className="chat-history">
        {visibleSessions.map(session => <div key={session.id} className={`chat-history-row ${session.id === active?.id ? 'is-active' : ''}`}>
          <button className="chat-history-select" onClick={() => selectSession(session.id)}><MessageCircle size={16}/><span>{session.title}</span></button>
          <button className="chat-history-delete" aria-label={`Hapus ${session.title}`} onClick={() => removeSession(session.id)}><Trash2 size={14}/></button>
        </div>)}
      </div>
      <div className="chat-sidebar-bottom"><div className="chat-explore-note"><Compass size={23}/><strong>Jalan-jalan dimulai<br/>dari rasa penasaran.</strong><button onClick={() => { cancelWork(); onBack?.() }}>Cari inspirasi <ChevronRight size={14}/></button></div>
        <button className="chat-settings-button" onClick={openSettings}><span className="chat-profile">{user?.name?.slice(0, 1).toUpperCase() || 'K'}</span><span><strong>{user?.name || 'Kawan Nusa'}</strong><small>{user ? 'Akun terhubung' : 'Masuk untuk mulai mengobrol'}</small></span><Settings2 size={17}/></button>
      </div>
    </aside>

    <main ref={mainRef} className={`chat-main ${provider.state !== 'configured' || !remoteReady ? 'has-service-notice' : ''}`} inert={cameraOpen || settings || (isMobile && sidebar)}>
      {isMobile && <MobileCallStage avatarStatus={avatarStatus} speaking={speaking} status={status} listening={listening} speechActivity={speechActivityRef} greeting={greeting} paused={cameraOpen || settings || sidebar}/>}
      <header className="chat-topbar"><div className="chat-heading"><button className="chat-icon-button chat-menu" aria-label="Buka riwayat" onClick={openSidebar}><Menu size={21}/></button><button className="chat-icon-button chat-back" aria-label="Kembali ke beranda" onClick={() => { cancelWork(); onBack?.() }}><ArrowLeft size={18}/></button><div><strong>Ruang jelajah</strong><span>Bersama Nusa, teman perjalananmu</span></div></div><div className="chat-top-actions"><span className={`chat-mode ${aiReady ? 'is-live' : ''}`}><i/>{aiReady ? 'AI langsung' : connection === 'checking' || provider.state === 'checking' ? 'Memeriksa AI' : !token ? 'Masuk akun' : 'Belum terhubung'}</span><button className={`chat-icon-button ${voice ? 'is-enabled' : ''}`} onClick={toggleVoice} title={voice ? 'Matikan suara otomatis' : 'Aktifkan suara otomatis'} aria-label={voice ? 'Matikan suara otomatis' : 'Aktifkan suara otomatis'} aria-pressed={voice}>{voice ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><button className="chat-icon-button" aria-label="Pengaturan dan akun" onClick={openSettings}><Settings2 size={19}/></button></div></header>

      {provider.state !== 'configured' && <ServiceNotice title={provider.state === 'checking' ? 'Memeriksa layanan AI…' : 'Layanan AI belum terhubung'} message={provider.message} checking={provider.state === 'checking'}>{provider.state !== 'checking' && <button onClick={() => setConnectionAttempt(value => value + 1)}>Periksa lagi</button>}</ServiceNotice>}

      {!remoteReady && provider.state === 'configured' && <ServiceNotice title={connection === 'checking' ? 'Memeriksa akun…' : 'Masuk untuk mengobrol dengan Nusa'} message="Pesan dan lampiran akan dikirim langsung ke layanan AI setelah akunmu terhubung." checking={connection === 'checking'}><button disabled={connection === 'checking' || busy} onClick={openSettings}>Masuk / buat akun<ChevronRight size={14}/></button></ServiceNotice>}

      <div id="nusa-conversation" ref={conversationRef} tabIndex={-1} role="region" aria-label="Percakapan dengan Nusa" inert={isMobile && !mobileChatOpen} className={`chat-conversation ${messages.length ? 'has-messages' : ''}`}>
        {isMobile && <div className="chat-call-sheet-heading"><div><span>CATATAN PERJALANAN</span><h2>Percakapan kita.</h2></div><button type="button" onClick={() => setMobileChatOpen(false)} aria-label="Tutup panel percakapan"><ChevronDown size={21}/></button></div>}
        {!messages.length ? <div className="chat-welcome">
          <div className="chat-welcome-intro"><span className="chat-welcome-eyebrow"><span/> RUANG UNTUK RASA PENASARAN</span><div className="chat-welcome-mark"><NusaMark size={78} strokeWidth={1}/></div><h1>Mau ke mana<br/><span>kita hari ini?</span></h1><p>Dari rencana spontan sampai perjalanan impian.<br/>Ceritakan idemu, kita mulai dari sana.</p><span className="chat-hero-coordinate"><Compass size={13}/> INDONESIA, SELALU ADA CERITA.</span></div>
          <div className="chat-prompt-heading"><h2>Mulai dari inspirasi kecil.</h2><span>PILIH & JELAJAHI <Route size={14}/></span></div>
          <div className="chat-prompt-grid">{CHAT_PROMPTS.map(prompt => { const Icon = ICONS[prompt.icon]; return <button key={prompt.label} onClick={() => sendMessage(prompt.prompt)} disabled={busy}><span className="chat-prompt-art" aria-hidden="true"><Icon size={25} strokeWidth={1.5}/></span><strong>{prompt.label}</strong><span className="chat-prompt-detail">{prompt.detail}</span><ChevronRight size={16}/></button> })}</div><span className="chat-welcome-note">{aiReady ? 'Terhubung ke AI. Ceritakan rencanamu atau lampirkan foto perjalanan.' : !token ? 'Masuk untuk memulai percakapan. Ide dan lampiranmu tetap ada di sini.' : provider.message}</span>
        </div> : <div className="chat-message-list">
          <div className="chat-day-label"><span/> Petualangan hari ini <span/></div>
          {messages.map((message, index) => <article key={message.id} className={`chat-message chat-message-${message.role}`}>
            <div className="chat-message-avatar">{message.role === 'assistant' ? <NusaMark size={25}/> : user?.name?.slice(0, 1).toUpperCase() || 'K'}</div>
            <div className="chat-message-body">
              <div className="chat-message-meta"><strong>{message.role === 'assistant' ? 'Nusa' : 'Kamu'}</strong>{message.role === 'assistant' && <span>{message.fallbackUsed ? `MODEL CADANGAN · ${getModelDisplayName(message.model)}` : message.model ? getModelDisplayName(message.model) : 'AI COMPANION'}</span>}</div>
              {message.content && <div className="chat-message-content"><MessageContent text={message.content}/>{status === 'responding' && index === messages.length - 1 && <i className="chat-writing-cursor"/>}</div>}
              <AttachmentList attachments={message.attachments} uploadState={message.uploadState} refreshing={busy || historyState === 'loading' || connection === 'checking'} onRefresh={() => setConnectionAttempt(value => value + 1)}/>
              {message.role === 'assistant' && !(status === 'responding' && index === messages.length - 1) && <div className="chat-message-tools"><button onClick={() => copyMessage(message)} aria-label="Salin jawaban">{copied === message.id ? <Check size={14}/> : <Copy size={14}/>} {copied === message.id ? 'Tersalin' : 'Salin'}</button><button onClick={() => speak(message.content)} aria-label="Bacakan jawaban"><Volume2 size={15}/> Dengarkan</button></div>}
            </div>
          </article>)}
          {status === 'thinking' && <div className="chat-thinking" role="status"><span className="chat-message-avatar"><Leaf size={18}/></span><span>Nusa sedang merangkai ide</span><i/><i/><i/></div>}
          <div ref={bottomRef}/>
        </div>}
      </div>

      <div className="chat-compose-area" ref={composeAreaRef}>
        {isMobile && <MobileCallDock open={mobileChatOpen} onToggle={() => setMobileChatOpen(value => !value)} onGreet={() => setGreeting(value => value + 1)} messages={messages} status={status} listening={listening}/>}
        {notice && <div className="chat-notice" role="status"><span>{notice}</span><button aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}><X size={15}/></button>{!busy && lastMessageRef.current?.sessionId === active?.id && canRetry && <button className="chat-retry" onClick={() => sendMessage(lastPromptRef.current, true)}>Coba lagi</button>}</div>}
        {listening && <div className="chat-listening" role="status"><AudioLines size={16}/> Mendengarkan… pesan akan muncul di kotak di bawah.</div>}
        <form className={`chat-composer ${listening ? 'is-listening' : ''}`} onSubmit={event => { event.preventDefault(); sendMessage(input) }}>
          {attachments.length > 0 && <><div className="chat-selected-files" aria-label="Lampiran yang dipilih">{attachments.map(item => {
            const Icon = item.file.type.startsWith('audio/') ? FileAudio : item.file.type.startsWith('video/') ? FileVideo : Image
            return <div className="chat-selected-file" key={item.id}>{item.previewUrl ? <img src={item.previewUrl} alt={`Pratinjau ${item.file.name}`}/> : <span className="chat-file-type"><Icon size={21}/></span>}<span><strong>{item.file.name}</strong><small>{formatFileSize(item.file.size)}</small></span><button type="button" disabled={busy} onClick={() => removeAttachment(item.id)} aria-label={`Hapus lampiran ${item.file.name}`}><X size={13}/></button></div>
          })}</div><p className="chat-attachment-note">{`Gambar, audio, atau video · Maks. ${uploadLimits.max_attachment_count} berkas, ${formatFileSize(uploadLimits.max_attachment_bytes)}/berkas, total ${formatFileSize(uploadLimits.max_total_attachment_bytes)}`}{!remoteReady && <button type="button" onClick={openSettings}>Masuk untuk mengirim <ChevronRight size={11}/></button>}</p></>}
          <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(input) } }} placeholder={attachments.length ? 'Tanyakan sesuatu tentang lampiranmu…' : 'Ceritakan perjalanan impianmu…'} aria-label="Pesan untuk Nusa" rows={1} maxLength={10000} disabled={busy}/>
          <input className="chat-file-input" ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={selectFiles} tabIndex={-1} aria-label="Pilih gambar, audio, atau video" disabled={busy || !uploadsEnabled}/>
          <div className="chat-composer-controls"><span><Compass size={15}/> Cerita bisa dari foto.</span><div>
            <button type="button" className="chat-attach-button" onClick={() => fileInputRef.current?.click()} disabled={busy || !uploadsEnabled} aria-label={uploadsEnabled ? 'Lampirkan gambar, audio, atau video' : 'Lampiran dinonaktifkan oleh layanan ini'} title={uploadsEnabled ? 'Lampirkan gambar, audio, atau video' : 'Lampiran dinonaktifkan oleh layanan ini'}><Paperclip size={18}/></button>
            <button type="button" className="chat-camera-button" onClick={() => { recognitionRef.current?.abort(); setListening(false); speechControllerRef.current?.stop(); setCameraOpen(true) }} disabled={busy || !uploadsEnabled || attachments.length >= uploadLimits.max_attachment_count} aria-label="Ambil gambar dari kamera" title="Ambil gambar dari kamera"><Camera size={19}/></button>
            <button type="button" className={`chat-microphone ${listening ? 'is-active' : ''}`} onClick={toggleListening} disabled={busy} aria-label={listening ? 'Hentikan dikte' : 'Dikte pesan dengan suara'}>{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button>
            {busy || speaking ? <button type="button" className="chat-send" onClick={() => { cancelWork(); setNotice('Respons dihentikan. Kamu bisa melanjutkan percakapan kapan saja.') }} aria-label="Hentikan respons"><Square size={15} fill="currentColor"/></button> : <button type="submit" className="chat-send" disabled={!input.trim() && !attachments.length} aria-label="Kirim pesan"><ArrowUp size={20}/></button>}
          </div></div>
        </form><div className="chat-composer-footer"><span>AI dapat keliru. Periksa informasi penting sebelum bepergian.</span><span>Enter untuk kirim ↵</span></div>
      </div>
    </main>

    {!isMobile && <aside className="chat-companion" inert={settings || cameraOpen}><div className="chat-companion-top"><span className="chat-section-label">TEMAN JELAJAHMU</span><span className="chat-companion-live"><i/> NUSA 3D</span></div><div className="chat-avatar-stage"><div className="chat-avatar-orbit"/><span className="chat-avatar-coordinate">N / 01</span><ErrorBoundary fallback={<div className="chat-avatar-fallback"><NusaMark size={70}/><p>Halo, aku Nusa!</p></div>}><AvatarCanvas isSpeaking={speaking} isResponding={status === 'responding'} speechActivity={speechActivityRef} isThinking={status === 'thinking'} isListening={listening} greeting={greeting} framing="conversation" paused={settings || cameraOpen}/></ErrorBoundary><button className="chat-wave-button" onClick={() => setGreeting(v => v + 1)} aria-label="Sapa Nusa">👋 Sapa Nusa</button></div><div className="chat-companion-name"><h2>Kenalan dengan Nusa<span>.</span></h2><p>Partner kecil, petualangan besar.</p><span className={`chat-avatar-status ${busy || speaking || listening ? 'is-animated' : ''}`}><i/>{avatarStatus}</span></div><div className="chat-companion-tip"><span><Sun size={18}/> CATATAN PERJALANAN</span><p>Perjalanan terbaik bukan selalu yang terjauh. Kadang, cukup mulai dengan tempat yang belum pernah kamu lihat.</p><div/><small>Rasa penasaran adalah kompasmu. <Compass size={14}/></small></div><div className="chat-companion-foot"><ShieldCheck size={15}/> Riwayat tersimpan di perangkat ini.</div></aside>}

    {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={attachCameraPhoto}/>}

    {settings && <div className="chat-modal-overlay" onClick={event => { if (event.target === event.currentTarget) setSettings(false) }}><section className="chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-settings-title" ref={settingsRef}><div className="chat-modal-header"><span className="chat-logo"><Leaf size={21}/></span><button className="chat-icon-button" onClick={() => setSettings(false)} aria-label="Tutup pengaturan"><X size={21}/></button></div><h2 id="chat-settings-title">Jelajah lebih personal.</h2><p>Hubungkan akunmu untuk mengobrol langsung dengan Nusa AI.</p><div className="chat-account-status"><i className={remoteReady ? 'is-live' : ''}/>{connection === 'checking' ? 'Memeriksa koneksi…' : remoteReady ? `Terhubung sebagai ${user?.name || 'Kawan Nusa'}` : connection === 'offline' ? 'Layanan belum terhubung' : 'Masuk atau buat akun untuk mulai mengobrol'}</div>
      {user && token ? <div className="chat-account-detail"><strong>{user.name}</strong><span>{user.email}</span><button onClick={logout}><LogOut size={16}/> Keluar dari akun</button>{connection === 'offline' && <button onClick={() => setConnectionAttempt(v => v + 1)}>Coba hubungkan kembali</button>}</div> : <><div className="chat-auth-tabs"><button className={authMode === 'login' ? 'is-active' : ''} onClick={() => { setAuthMode('login'); setAuthError('') }}>Masuk</button><button className={authMode === 'register' ? 'is-active' : ''} onClick={() => { setAuthMode('register'); setAuthError('') }}>Buat akun</button></div><form onSubmit={authenticate}>{authMode === 'register' && <label>Nama<input name="name" autoComplete="name" value={authForm.name} onChange={event => setAuthForm({ ...authForm, name: event.target.value })} required placeholder="Nama panggilanmu"/></label>}<label>Email<input type="email" autoComplete="email" name="email" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} required placeholder="kamu@email.com"/></label><label>Kata sandi<input type="password" name="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 8 : 1} value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} required placeholder={authMode === 'register' ? 'Minimal 8 karakter' : 'Kata sandi akunmu'}/></label>{authMode === 'register' && <label>Ulangi kata sandi<input type="password" autoComplete="new-password" name="password_confirmation" minLength={8} value={authForm.password_confirmation} onChange={event => setAuthForm({ ...authForm, password_confirmation: event.target.value })} required placeholder="Ketik sekali lagi"/></label>}{authError && <div className="chat-auth-error" role="alert">{authError}</div>}<button className="chat-auth-submit" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle size={18} className="chat-spinner"/> : authMode === 'register' ? 'Buat akun & mulai jelajah' : 'Masuk & mulai jelajah'}<ChevronRight size={17}/></button></form></>}
      <div className="chat-provider-state">{token && <div role="status"><p>{historyState === 'loading' ? 'Memuat riwayat akun…' : historyState === 'error' ? 'Sebagian riwayat belum dapat dimuat. Coba segarkan kembali.' : 'Riwayat akun dan tautan lampiran dapat disegarkan.'}</p><button disabled={busy || historyState === 'loading' || connection === 'checking'} onClick={() => setConnectionAttempt(value => value + 1)}>Segarkan riwayat & lampiran</button></div>}<strong>{provider.state === 'configured' ? 'AI siap dicoba' : provider.state === 'checking' ? 'Memeriksa AI…' : 'AI belum tersedia'}</strong><p>{provider.message}</p><button onClick={() => setConnectionAttempt(value => value + 1)}>Periksa layanan</button></div>
      <details className="chat-advanced"><summary>Pengaturan koneksi</summary><form onSubmit={applyBackend}><label>Alamat layanan<input type="text" inputMode="url" value={backendDraft} onChange={event => { setBackendDraft(event.target.value); setConnectionError('') }} placeholder="/api" aria-describedby="chat-connection-help"/></label><small id="chat-connection-help">Gunakan alamat khusus hanya jika diarahkan pengelola. Mengganti layanan mengeluarkan akun dari perangkat ini.</small>{connectionError && <p className="chat-auth-error" role="alert">{connectionError}</p>}<button type="submit" className="chat-auth-submit">Terapkan alamat layanan</button></form></details><div className="chat-modal-footer"><Headphones size={16}/><span>Suara menggunakan fitur yang tersedia di browser.</span></div></section></div>}
  </div>
}
