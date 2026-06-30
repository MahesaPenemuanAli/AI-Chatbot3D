import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Activity,
  AlertCircle,
  Calendar,
  Camera,
  Check,
  Compass,
  Copy,
  Globe,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Mic,
  Paperclip,
  Plus,
  Send,
  Settings,
  Share2,
  Sparkles,
  Square,
  Trash2,
  X
} from 'lucide-react'
import './App.css'
import AvatarCanvas from './components/AvatarCanvas'
import ErrorBoundary from './components/ErrorBoundary'
import { WeatherWidget, MapWidget, ItineraryWidget } from './components/TravelWidgets'

const INITIAL_SESSIONS = [
  { id: 'session-1', title: 'Eksplorasi Candi Borobudur', model: 'Gemini 2.5 Pro', guide: 'Siti' },
  { id: 'session-2', title: 'Liburan ke Pantai Kelingking', model: 'Gemini 1.5 Flash', guide: 'Budi' },
  { id: 'session-3', title: 'Kuliner Legendaris Yogyakarta', model: 'Claude 3.5 Sonnet', guide: 'Aditya' }
]

const INITIAL_MESSAGES = {
  'session-1': [
    { id: 1, role: 'user', content: 'Kapan waktu terbaik berkunjung ke Candi Borobudur?' },
    { id: 2, role: 'assistant', content: 'Waktu terbaik untuk berkunjung adalah saat **sunrise (matahari terbit)** sekitar pukul 04.30 WIB atau saat **sunset (matahari terbenam)** sore hari.\n\nSelain udaranya masih sejuk, pemandangan kabut pagi yang menyelimuti lembah di sekitar candi dengan latar belakang Gunung Merapi sangatlah magis dan indah untuk berfoto!' }
  ],
  'session-2': [
    { id: 1, role: 'user', content: 'Ada rekomendasi pantai tenang di Bali?' },
    { id: 2, role: 'assistant', content: 'Tentu! Jika Anda mencari ketenangan di Bali, saya sangat menyarankan mengunjungi **Pantai Gunung Payung** di Selatan Bali atau **Pantai Bias Tugel** di Padangbai.\n\nKedua pantai ini memiliki pasir putih yang sangat bersih, dikelilingi tebing tinggi, dan relatif sepi dari keramaian turis utama.' }
  ],
  'session-3': [
    { id: 1, role: 'user', content: 'Rekomendasi kuliner wajib di Jogja selain gudeg?' },
    { id: 2, role: 'assistant', content: 'Berikut kuliner legendaris Yogyakarta yang wajib dicoba:\n\n* **Sate Klatak Pak Pong**: Sate kambing muda yang ditusuk menggunakan jeruji besi sepeda dan dibumbui garam saja.\n* **Bakmi Jawa Mbah Gito**: Bakmi tradisional dengan kuah kaldu ayam kampung kental, dimasak menggunakan anglo arang.\n* **Mangut Lele Mbah Marto**: Lele asap yang dimasak dengan kuah santan pedas gurih di dapur tradisional kayu bakar.' }
  ]
}

const GUIDES = [
  {
    id: 'Siti',
    name: 'Siti',
    initials: 'ST',
    role: 'Pemandu Alam & Petualangan',
    specialty: 'Rute alam',
    accent: 'from-emerald-500 to-cyan-500',
    modelUrl: 'https://models.readyplayer.me/64b5e612f0e0c3453b3f66a2.glb'
  },
  {
    id: 'Budi',
    name: 'Budi',
    initials: 'BD',
    role: 'Pemandu Sejarah & Budaya',
    specialty: 'Budaya',
    accent: 'from-cyan-500 to-sky-500',
    modelUrl: 'https://models.readyplayer.me/64b5e6cf2c2f6d0f507b56a1.glb'
  },
  {
    id: 'Aditya',
    name: 'Aditya',
    initials: 'AD',
    role: 'Pemandu Kuliner & Rekreasi',
    specialty: 'Kuliner',
    accent: 'from-amber-400 to-orange-500',
    modelUrl: 'https://models.readyplayer.me/64b5e7392c2f6d0f507b5a83.glb'
  }
]

const MODEL_OPTIONS = ['Gemini 2.5 Pro', 'Gemini 1.5 Flash', 'Claude 3.5 Sonnet']

const NAV_ACTIONS = [
  { label: 'Destinasi', icon: MapPin, prompt: 'Tunjukkan destinasi populer di Indonesia' },
  { label: 'Reservasi', icon: Calendar, prompt: 'Bagaimana cara membuat reservasi hotel dekat pantai?' },
  { label: 'Promo', icon: Sparkles, prompt: 'Apakah ada promo wisata keluarga akhir pekan ini?' }
]

const QUICK_ACTIONS = [
  { label: 'Jelajahi', icon: Compass, prompt: 'Rekomendasikan destinasi terpopuler di Indonesia' },
  { label: 'Peta', icon: MapPin, prompt: 'Tampilkan peta wisata Bali dan Yogyakarta' },
  { label: 'Jadwal', icon: Calendar, prompt: 'Tolong tunjukkan jadwal festival budaya terdekat' },
  { label: 'Suara', icon: Mic, action: 'voice' },
  { label: 'Foto', icon: Camera, action: 'photo' },
  { label: 'Bagikan', icon: Share2, action: 'share' }
]

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('tour_sessions')
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS
  })

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('tour_active_session_id')
    return saved || 'session-2'
  })

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('tour_messages')
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES
  })

  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModel, setSelectedModel] = useState('Gemini 2.5 Pro')
  const [selectedGuide, setSelectedGuide] = useState('Budi')
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000/api')

  const [token, setToken] = useState(() => localStorage.getItem('sanctum_token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_data')
    return saved ? JSON.parse(saved) : null
  })

  const [connectionStatus, setConnectionStatus] = useState('sandbox')

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [authTab, setAuthTab] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [authError, setAuthError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const handleLogout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${backendUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
      } catch {}
    }
    setToken('')
    setUser(null)
    localStorage.removeItem('sanctum_token')
    localStorage.removeItem('user_data')
    setConnectionStatus('sandbox')
  }, [backendUrl, token])

  const checkBackendHealth = useCallback(async () => {
    try {
      const headers = { 'Accept': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const endpoint = token ? `${backendUrl}/user` : `${backendUrl.replace('/api', '')}`
      const response = await fetch(endpoint, { method: 'GET', headers })

      if (response.ok) {
        setConnectionStatus('live')
        if (token) {
          const userData = await response.json()
          setUser(userData)
          localStorage.setItem('user_data', JSON.stringify(userData))
        }
      } else {
        if (response.status === 401) {
          handleLogout()
        }
        setConnectionStatus('sandbox')
      }
    } catch {
      setConnectionStatus('sandbox')
    }
  }, [backendUrl, handleLogout, token])

  useEffect(() => {
    localStorage.setItem('tour_sessions', JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    localStorage.setItem('tour_active_session_id', activeSessionId)
    const active = sessions.find(s => s.id === activeSessionId)
    if (active && active.guide) {
      setSelectedGuide(active.guide)
    }
  }, [activeSessionId, sessions])

  useEffect(() => {
    localStorage.setItem('tour_messages', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [messages, activeSessionId, isTyping])

  useEffect(() => {
    checkBackendHealth()
  }, [checkBackendHealth])

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')

    const endpoint = authTab === 'login' ? `${backendUrl}/login` : `${backendUrl}/register`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(authForm)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Gagal masuk. Silakan periksa kembali email dan password Anda.')
      }

      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('sanctum_token', data.token)
      localStorage.setItem('user_data', JSON.stringify(data.user))
      setConnectionStatus('live')
      setIsSettingsOpen(false)
      setAuthForm({ name: '', email: '', password: '', password_confirmation: '' })
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const handleNewSession = () => {
    const newId = `session-${Date.now()}`
    const newSession = {
      id: newId,
      title: 'Destinasi Wisata Baru',
      model: selectedModel,
      guide: selectedGuide
    }
    setSessions([newSession, ...sessions])
    setMessages({
      ...messages,
      [newId]: []
    })
    setActiveSessionId(newId)
    setIsSidebarOpen(false)
  }

  const handleDeleteSession = (id, e) => {
    e.stopPropagation()
    const updatedSessions = sessions.filter(s => s.id !== id)
    setSessions(updatedSessions)

    const updatedMessages = { ...messages }
    delete updatedMessages[id]
    setMessages(updatedMessages)

    if (activeSessionId === id && updatedSessions.length > 0) {
      setActiveSessionId(updatedSessions[0].id)
    } else if (updatedSessions.length === 0) {
      const newId = `session-${Date.now()}`
      setSessions([{ id: newId, title: 'Destinasi Wisata Baru', model: selectedModel, guide: selectedGuide }])
      setMessages({ [newId]: [] })
      setActiveSessionId(newId)
    }
  }

  const handleGuideSelect = (guideId) => {
    setSelectedGuide(guideId)
    if (currentSession) {
      setSessions(prev => prev.map(session => (
        session.id === activeSessionId ? { ...session, guide: guideId } : session
      )))
    }
  }

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const cleanText = text.replace(/[*#`_-]/g, '')
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'id-ID'

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      window.speechSynthesis.speak(utterance)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...filesArray])
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioFile = new File([audioBlob], 'voice_message.wav', { type: 'audio/wav' })

        handleSendMessageDirectly('Mengirimkan pesan suara...', [audioFile])

        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      alert('Tidak dapat mengakses mikrofon: ' + err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSendMessageDirectly = async (text, files = []) => {
    const userMsgText = text
    const filesToSend = files.length > 0 ? files : selectedFiles
    setSelectedFiles([])

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: userMsgText,
      files: filesToSend.map(f => ({ name: f.name, type: f.type }))
    }

    const currentSessionMessages = messages[activeSessionId] || []
    const updatedSessionMessages = [...currentSessionMessages, userMessage]

    setMessages({
      ...messages,
      [activeSessionId]: updatedSessionMessages
    })

    setIsTyping(true)

    if (connectionStatus === 'live' && token) {
      try {
        const formData = new FormData()
        formData.append('message', userMsgText)
        formData.append('model', selectedModel)

        filesToSend.forEach((file, index) => {
          formData.append(`attachments[${index}]`, file)
        })

        const response = await fetch(`${backendUrl}/chat/sessions/${activeSessionId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          body: formData
        })

        if (!response.ok) throw new Error('API gagal merespons')
        const data = await response.json()

        setMessages(prev => ({
          ...prev,
          [activeSessionId]: [...updatedSessionMessages, {
            id: Date.now() + 1,
            role: 'assistant',
            content: data.ai_message.content
          }]
        }))

        if (data.ai_message.audio_url) {
          const audio = new Audio(data.ai_message.audio_url)
          audio.onplay = () => setIsSpeaking(true)
          audio.onended = () => setIsSpeaking(false)
          audio.play()
        } else {
          speakText(data.ai_message.content)
        }

        setIsTyping(false)
        return
      } catch (err) {
        console.warn('Backend gagal merespons, beralih ke simulasi lokal', err)
      }
    }

    setTimeout(() => {
      let replyText = `Saya telah menerima pertanyaan Anda tentang "${userMsgText}". Saat ini saya sedang berjalan di **Sandbox Mode** (belum terhubung ke backend Laravel).\n\nUntuk menghubungkan dengan asisten pariwisata yang aktif:\n1. Jalankan database di XAMPP.\n2. Jalankan \`php artisan serve\` di folder \`backend\`.\n3. Masuk/Login melalui modal pengaturan di aplikasi ini.`

      const lowerInput = userMsgText.toLowerCase()
      const currentGuideData = GUIDES.find(g => g.id === selectedGuide)
      const guidePrefix = `Halo! Saya **${currentGuideData.name}**, ${currentGuideData.role} Anda. `

      if (lowerInput.includes('bali') || lowerInput.includes('kelingking') || lowerInput.includes('pantai')) {
        replyText = guidePrefix + `Pantai Kelingking adalah ikon keindahan Nusa Penida. Tebing karangnya menyerupai dinosaurus T-Rex yang menjorok ke Samudera Hindia.\n\nJika ingin turun, pastikan menggunakan sepatu yang nyaman dan membawa air minum yang cukup karena jalurnya sangat terjal dan melelahkan.`
      } else if (lowerInput.includes('borobudur') || lowerInput.includes('candi') || lowerInput.includes('sejarah')) {
        replyText = guidePrefix + `Candi Borobudur dibangun pada abad ke-9 oleh Dinasti Syailendra. Candi ini memiliki struktur tiga tingkatan yang melambangkan kosmologi Buddha: Kamadhatu (dunia hasrat), Rupadhatu (dunia wujud), dan Arupadhatu (dunia tanpa wujud).\n\nSekarang, pengunjung wajib menggunakan alas kaki khusus *Upanat* untuk menjaga kelestarian struktur batu candi.`
      } else if (lowerInput.includes('kuliner') || lowerInput.includes('makan') || lowerInput.includes('khas')) {
        replyText = guidePrefix + `Sebagai pemandu Anda, saya merekomendasikan untuk mencoba kuliner otentik di sekitar lokasi wisata. Misalnya, jika Anda di Yogyakarta, cobalah Sate Klatak Pak Pong atau Kopi Klotok di Sleman yang menyajikan suasana pedesaan yang asri.`
      }

      setMessages(prev => ({
        ...prev,
        [activeSessionId]: [...updatedSessionMessages, {
          id: Date.now() + 1,
          role: 'assistant',
          content: replyText
        }]
      }))

      speakText(replyText)
      setIsTyping(false)
    }, 1500)
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() && selectedFiles.length === 0) return
    handleSendMessageDirectly(input.trim())
    setInput('')
  }

  const handleQuickAction = (item) => {
    if (item.action === 'voice') {
      startRecording()
      return
    }
    if (item.action === 'photo') {
      triggerFileSelect()
      return
    }
    if (item.action === 'share') {
      alert('Bagikan tautan asisten ini: ' + window.location.href)
      return
    }
    setInput(item.prompt)
  }

  const handleCopyCode = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const renderWidgets = (content) => {
    const lower = content.toLowerCase()
    const widgets = []

    if (lower.includes('borobudur')) {
      widgets.push(<WeatherWidget key="weather-boro" destination="Candi Borobudur, Magelang" />)
      widgets.push(<MapWidget key="map-boro" destination="Candi Borobudur" coordinates="S: 7.6080, E: 110.2040" />)
    } else if (lower.includes('kelingking') || lower.includes('nusa penida')) {
      widgets.push(<WeatherWidget key="weather-kel" destination="Pantai Kelingking, Bali" />)
      widgets.push(<MapWidget key="map-kel" destination="Kelingking Beach, Nusa Penida" coordinates="S: 8.7391, E: 115.4711" />)
    } else if (lower.includes('yogyakarta') || lower.includes('jogja')) {
      widgets.push(<WeatherWidget key="weather-jog" destination="Yogyakarta" />)
      widgets.push(<MapWidget key="map-jog" destination="Jalan Malioboro, Yogyakarta" coordinates="S: 7.7971, E: 110.3688" />)
    }

    if (lower.includes('rencana') || lower.includes('itinerary') || lower.includes('rute') || lower.includes('cara menuju')) {
      const mockItinerary = [
        { time: 'Hari 1: Kedatangan', title: 'Tiba & Check-in Hotel', description: 'Tiba di lokasi destinasi utama, beristirahat sejenak, dan menikmati makan malam lokal khas daerah sekitar.' },
        { time: 'Hari 2: Eksplorasi Utama', title: 'Wisata Budaya & Spot Foto Terbaik', description: 'Menjelajahi ikon wisata terpopuler mulai pagi hari untuk mendapatkan pencahayaan foto terbaik.' },
        { time: 'Hari 3: Wisata Kuliner & Belanja', title: 'Cinderamata & Kepulangan', description: 'Membeli buah tangan/oleh-oleh kerajinan lokal dan bersiap untuk perjalanan pulang.' }
      ]
      widgets.push(<ItineraryWidget key="itinerary" items={mockItinerary} />)
    }

    return widgets.length > 0 ? <div className="mt-3 space-y-3">{widgets}</div> : null
  }

  const renderMessageContent = (content) => {
    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/)
        const lang = match ? match[1] : ''
        const code = match ? match[2] : part.slice(3, -3)
        const codeId = `${index}-${lang}`

        return (
          <div key={index} className="group relative my-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] text-cyan-200">
              <span>{lang || 'code'}</span>
              <button
                onClick={() => handleCopyCode(code, codeId)}
                className="flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-white/10 hover:text-white"
              >
                {copiedId === codeId ? <Check size={11} /> : <Copy size={11} />}
                {copiedId === codeId ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="m-0 overflow-x-auto p-3">
              <code className="font-mono text-[11px] text-emerald-200">{code}</code>
            </pre>
          </div>
        )
      }

      return (
        <p key={index} className="m-0 whitespace-pre-wrap leading-relaxed">
          {part.split('**').map((subPart, subIndex) => {
            if (subIndex % 2 === 1) {
              return <strong key={subIndex} className="font-semibold text-teal-700">{subPart}</strong>
            }
            return subPart.split('*').map((italicPart, italicIndex) => {
              if (italicIndex % 2 === 1) {
                return <em key={italicIndex} className="text-cyan-700">{italicPart}</em>
              }
              return italicPart
            })
          })}
        </p>
      )
    })
  }

  const currentSession = sessions.find(s => s.id === activeSessionId)
  const currentMessages = messages[activeSessionId] || []
  const activeGuideData = GUIDES.find(g => g.id === selectedGuide) || GUIDES[0]
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'T'

  return (
    <div className="tripmate-root relative h-screen w-screen overflow-hidden text-slate-900">
      <div className="scenic-backdrop absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-emerald-950/25 to-transparent" />

      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden p-3 sm:p-5 lg:p-7">
        <section className="desktop-shell mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col overflow-hidden rounded-[24px] border border-white/65 bg-white/45 shadow-[0_28px_90px_rgba(8,47,73,0.22)] backdrop-blur-2xl">
          <div className="hidden h-12 shrink-0 items-center gap-4 border-b border-white/60 bg-white/70 px-5 sm:flex">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="mx-auto flex h-8 w-full max-w-2xl items-center justify-center rounded-full border border-slate-200 bg-slate-100/80 text-[11px] font-medium text-slate-400">
              tripmate.ai/travel-assistant
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Globe size={16} />
              <Plus size={17} />
              <Share2 size={16} />
            </div>
          </div>

          <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/55 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                aria-label="Buka menu"
              >
                <Menu size={22} />
              </button>

              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-amber-300 via-cyan-400 to-emerald-500 text-white shadow-lg shadow-cyan-500/20">
                  <Compass size={24} />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">TripMate AI</h1>
                  <p className="hidden text-xs font-medium text-slate-500 sm:block">Chatbot Pariwisata</p>
                </div>
              </div>
            </div>

            <nav className="hidden items-center gap-2 md:flex">
              {NAV_ACTIONS.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setInput(item.prompt)}
                    className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-teal-700"
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-slate-900">{user ? user.name : 'Tamu Wisata'}</p>
                <p className="flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${connectionStatus === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  {connectionStatus === 'live' ? 'Mode Live' : 'Mode Demo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
                aria-label="Buka pengaturan akun"
              >
                {userInitial}
              </button>
            </div>
          </header>

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <div className="stage-photo absolute inset-0" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(240,253,250,0.92)_0%,rgba(240,253,250,0.58)_38%,rgba(14,116,144,0.10)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-teal-950/35 via-teal-900/8 to-transparent" />
            <div className="sun-glow absolute right-[8%] top-[8%] h-56 w-56 rounded-full bg-amber-200/55 blur-3xl" />

            <div className="relative z-10 h-full min-h-0">
              <div className="absolute right-0 top-0 h-full w-full sm:w-[70%] lg:w-[64%]">
                <ErrorBoundary fallback={
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-xs rounded-lg border border-white/60 bg-white/80 p-5 text-center shadow-xl backdrop-blur">
                      <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-tr ${activeGuideData.accent} text-sm font-black text-white`}>
                        {activeGuideData.initials}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{activeGuideData.name} Offline</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">Model 3D belum berhasil dimuat dari jaringan.</p>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-4 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-500"
                      >
                        Muat Ulang
                      </button>
                    </div>
                  </div>
                }>
                  <AvatarCanvas modelUrl={activeGuideData.modelUrl} isSpeaking={isSpeaking} />
                </ErrorBoundary>
              </div>

              <div className="pointer-events-none absolute left-4 top-4 z-20 hidden max-w-[300px] rounded-lg border border-white/65 bg-white/65 p-3 shadow-lg backdrop-blur-xl lg:block">
                <div className="flex items-center gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-tr ${activeGuideData.accent} text-sm font-black text-white shadow-lg`}>
                    {activeGuideData.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">{activeGuideData.name}</p>
                    <p className="truncate text-[11px] font-semibold text-slate-500">{activeGuideData.role}</p>
                  </div>
                </div>
              </div>

              <div className="message-scroll absolute bottom-[188px] left-3 right-3 top-4 z-20 overflow-y-auto pr-1 sm:bottom-[172px] sm:left-6 sm:right-auto sm:top-8 sm:w-[min(470px,48vw)] lg:top-24">
                <div className="flex min-h-full flex-col justify-end gap-3 pb-2">
                  {currentMessages.length === 0 ? (
                    <div className="rounded-lg border border-white/70 bg-white/80 p-5 shadow-xl backdrop-blur-xl">
                      <div className="mb-4 flex items-center gap-3">
                        <div className={`grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-tr ${activeGuideData.accent} text-sm font-black text-white`}>
                          {activeGuideData.initials}
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-slate-950">Halo, saya {activeGuideData.name}</h2>
                          <p className="text-xs font-semibold text-slate-500">{activeGuideData.specialty}</p>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600">
                        Mau kemana hari ini? Saya bisa bantu susun rute, rekomendasi tempat, estimasi cuaca, dan ide perjalanan.
                      </p>
                    </div>
                  ) : (
                    currentMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-tr ${activeGuideData.accent} text-[10px] font-black text-white shadow-md`}>
                            {activeGuideData.initials}
                          </div>
                        )}

                        <div
                          className={`max-w-[86%] rounded-lg px-4 py-3 text-sm leading-relaxed shadow-lg ${
                            msg.role === 'user'
                              ? 'rounded-br-sm bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-teal-900/15'
                              : 'rounded-bl-sm border border-white/70 bg-white/92 text-slate-700 shadow-slate-900/10 backdrop-blur-xl'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <p className="m-0 whitespace-pre-wrap">{msg.content || 'Mengirim lampiran perjalanan'}</p>
                          ) : (
                            renderMessageContent(msg.content)
                          )}

                          {msg.role !== 'user' && renderWidgets(msg.content)}

                          {msg.files && msg.files.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.files.map((file, i) => (
                                <div
                                  key={i}
                                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                                    msg.role === 'user' ? 'border-white/25 bg-white/15 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <Paperclip size={11} />
                                  <span className="max-w-[120px] truncate">{file.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isTyping && (
                    <div className="flex justify-start gap-2.5">
                      <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-tr ${activeGuideData.accent} text-[10px] font-black text-white shadow-md`}>
                        {activeGuideData.initials}
                      </div>
                      <div className="flex items-center gap-1 rounded-lg rounded-bl-sm border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl">
                        <span className="typing-dot" />
                        <span className="typing-dot [animation-delay:140ms]" />
                        <span className="typing-dot [animation-delay:280ms]" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3 z-30 sm:bottom-5 sm:left-1/2 sm:max-w-3xl sm:-translate-x-1/2">
                {selectedFiles.length > 0 && (
                  <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-lg border border-white/80 bg-white/90 p-2 shadow-lg backdrop-blur-xl">
                    {selectedFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-[9px] font-black uppercase text-teal-700">Vid</div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-bl-md bg-red-500 text-white"
                          aria-label="Hapus lampiran"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <span className="shrink-0 text-xs font-semibold text-slate-500">{selectedFiles.length} file dipilih</span>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex min-h-[58px] items-center gap-2 rounded-full border border-white/80 bg-white/95 p-2 shadow-[0_18px_55px_rgba(15,118,110,0.22)] backdrop-blur-xl">
                  {isRecording ? (
                    <div className="flex flex-1 items-center justify-between rounded-full bg-teal-50 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-teal-600 animate-ping" />
                        <span className="text-xs font-bold text-teal-800">Merekam Suara...</span>
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 text-white transition hover:bg-teal-500"
                        aria-label="Berhenti merekam"
                      >
                        <Square size={12} fill="white" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage(e)
                          }
                        }}
                        placeholder="Tanya TripMate AI..."
                        rows={1}
                        className="h-11 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={startRecording}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-teal-50 hover:text-teal-700"
                        aria-label="Live voice"
                      >
                        <Mic size={19} />
                      </button>

                      <button
                        type="button"
                        onClick={triggerFileSelect}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-cyan-50 hover:text-cyan-700"
                        aria-label="Ambil foto atau scan"
                      >
                        <Camera size={19} />
                      </button>
                    </>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept="image/*,video/*"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() && selectedFiles.length === 0}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
                      input.trim() || selectedFiles.length > 0
                        ? 'bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-700/20 hover:scale-105'
                        : 'bg-slate-100 text-slate-300'
                    }`}
                    aria-label="Kirim pesan"
                  >
                    <Send size={18} />
                  </button>
                </form>

                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {QUICK_ACTIONS.map(item => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleQuickAction(item)}
                        className="quick-action h-14 rounded-lg border border-white/55 bg-white/30 px-2 text-xs font-bold text-white shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/45"
                      >
                        <Icon size={17} className="mx-auto mb-1" />
                        <span className="block truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </main>
        </section>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex bg-slate-950/45 backdrop-blur-sm">
          <aside className="animate-slide-in flex h-full w-[330px] max-w-[86vw] flex-col border-r border-white/10 bg-slate-950/90 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-tr from-amber-300 via-cyan-400 to-emerald-500 text-white">
                  <Compass size={22} />
                </div>
                <div>
                  <p className="text-sm font-extrabold">Eksplorasi Anda</p>
                  <p className="text-xs font-medium text-slate-400">{sessions.length} sesi tersimpan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Pemandu</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-cyan-200">{selectedModel}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {GUIDES.map(guide => (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => handleGuideSelect(guide.id)}
                    className={`rounded-lg border p-2 text-left transition ${
                      selectedGuide === guide.id
                        ? 'border-cyan-300/55 bg-cyan-300/10 text-white shadow-lg shadow-cyan-950/20'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-tr ${guide.accent} text-[10px] font-black text-white`}>
                      {guide.initials}
                    </div>
                    <p className="text-xs font-bold">{guide.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{guide.specialty}</p>
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Model AI</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white outline-none transition focus:border-cyan-300"
              >
                {MODEL_OPTIONS.map(model => (
                  <option key={model} value={model} className="bg-slate-950 text-white">{model}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Destinasi</span>
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-teal-400"
                >
                  <Plus size={13} />
                  Baru
                </button>
              </div>

              <div className="space-y-2">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSessionId(session.id)
                      setIsSidebarOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveSessionId(session.id)
                        setIsSidebarOpen(false)
                      }
                    }}
                    className={`group flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                      activeSessionId === session.id
                        ? 'border-cyan-300/35 bg-white/10 text-white'
                        : 'border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin size={15} className={activeSessionId === session.id ? 'text-cyan-300' : 'text-slate-500'} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{session.title}</span>
                        <span className="block truncate text-[10px] text-slate-500">Pemandu: {session.guide || 'Siti'}</span>
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                      aria-label="Hapus sesi"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-white/10 p-4">
              <button
                type="button"
                onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false) }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/10"
              >
                <Settings size={15} />
                Pengaturan Sistem
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => { handleLogout(); setIsSidebarOpen(false) }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300/15 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/15"
                >
                  <LogOut size={15} />
                  Keluar Akun
                </button>
              )}
            </div>
          </aside>
          <button
            type="button"
            className="flex-1"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Tutup menu"
          />
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <Settings size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Pengaturan Sistem</h3>
                  <p className="text-[11px] font-medium text-slate-500">API, akun, dan autentikasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Tutup pengaturan"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">URL API Backend</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="http://localhost:8000/api"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                  />
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                  >
                    <Activity size={13} />
                    Uji
                  </button>
                </div>
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
                    <Check size={20} className="text-emerald-300" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-emerald-100">Koneksi Aktif</div>
                      <div className="truncate text-xs text-slate-400">Masuk sebagai {user.name} ({user.email})</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/15"
                  >
                    Keluar dari Akun
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-1">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setAuthError('') }}
                      className={`rounded-md px-3 py-2 text-xs font-bold transition ${authTab === 'login' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setAuthError('') }}
                      className={`rounded-md px-3 py-2 text-xs font-bold transition ${authTab === 'register' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      Daftar
                    </button>
                  </div>

                  {authError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-500/10 p-3">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-300" />
                      <span className="text-xs leading-relaxed text-red-100">{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    {authTab === 'register' && (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">Nama Lengkap</label>
                        <input
                          type="text"
                          required
                          value={authForm.name}
                          onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                          placeholder="Nama Anda"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">Email</label>
                      <input
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder="nama@domain.com"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">Password</label>
                      <input
                        type="password"
                        required
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        placeholder="Password"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                      />
                    </div>
                    {authTab === 'register' && (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">Konfirmasi Password</label>
                        <input
                          type="password"
                          required
                          value={authForm.password_confirmation}
                          onChange={(e) => setAuthForm({ ...authForm, password_confirmation: e.target.value })}
                          placeholder="Konfirmasi password"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-950/25 transition hover:from-teal-400 hover:to-cyan-400"
                    >
                      <Lock size={14} />
                      {authTab === 'login' ? 'Masuk' : 'Buat Akun'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
