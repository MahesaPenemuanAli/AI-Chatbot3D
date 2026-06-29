import { useState, useEffect, useRef } from 'react'
import { 
  Plus, Trash2, Send, Settings, User, 
  Sparkles, Paperclip, Mic, LogOut, Globe, Activity, Check, Copy, Lock, AlertCircle, Compass, MapPin, X, Square 
} from 'lucide-react'
import './App.css'
import AvatarCanvas from './components/AvatarCanvas'
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
    { id: 1, role: 'user', content: 'Bagaimana cara menuju Pantai Kelingking di Nusa Penida?' },
    { id: 2, role: 'assistant', content: 'Untuk menuju Pantai Kelingking, berikut rute praktisnya:\n\n1. **Naik Fastboat**: Dari pelabuhan Sanur di Bali menuju Pelabuhan Pelabuhan Buyuk atau Nyuh di Nusa Penida (sekitar 45 menit).\n2. **Sewa Motor/Mobil**: Setibanya di Nusa Penida, Anda bisa menyewa kendaraan. Jarak tempuh ke Pantai Kelingking sekitar 45-60 menit.\n3. **Turun ke Tebing**: Jika ingin turun ke pantai berpasir putihnya, siapkan fisik ekstra karena jalurnya sangat terjal dengan tangga bambu darurat.' }
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
    role: 'Pemandu Alam & Petualangan', 
    avatar: '🌴', 
    modelUrl: 'https://models.readyplayer.me/64b5e612f0e0c3453b3f66a2.glb' 
  },
  { 
    id: 'Budi', 
    name: 'Budi', 
    role: 'Pemandu Sejarah & Budaya', 
    avatar: '🏛️', 
    modelUrl: 'https://models.readyplayer.me/64b5e6cf2c2f6d0f507b56a1.glb' 
  },
  { 
    id: 'Aditya', 
    name: 'Aditya', 
    role: 'Pemandu Kuliner & Rekreasi', 
    avatar: '🍲', 
    modelUrl: 'https://models.readyplayer.me/64b5e7392c2f6d0f507b5a83.glb' 
  }
]

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('tour_sessions')
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS
  })
  
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('tour_active_session_id')
    return saved || 'session-1'
  })

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('tour_messages')
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES
  })

  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModel, setSelectedModel] = useState('Gemini 2.5 Pro')
  const [selectedGuide, setSelectedGuide] = useState('Siti')
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000/api')
  
  const [token, setToken] = useState(() => localStorage.getItem('sanctum_token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_data')
    return saved ? JSON.parse(saved) : null
  })

  const [connectionStatus, setConnectionStatus] = useState('sandbox')
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeSessionId, isTyping])

  useEffect(() => {
    checkBackendHealth()
  }, [backendUrl, token])

  const checkBackendHealth = async () => {
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
    } catch (e) {
      setConnectionStatus('sandbox')
    }
  }

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

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`${backendUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
      } catch (e) {}
    }
    setToken('')
    setUser(null)
    localStorage.removeItem('sanctum_token')
    localStorage.removeItem('user_data')
    setConnectionStatus('sandbox')
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

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const cleanText = text.replace(/[*#`_\-]/g, '')
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

    return widgets.length > 0 ? <div className="mt-4 space-y-2">{widgets}</div> : null
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
          <div key={index} className="relative group my-3 rounded-lg overflow-hidden border border-white/5 bg-black/50">
            <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5 text-[11px] text-emerald-400 font-mono">
              <span>{lang || 'code'}</span>
              <button 
                onClick={() => handleCopyCode(code, codeId)}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                {copiedId === codeId ? <Check size={11} /> : <Copy size={11} />}
                {copiedId === codeId ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="m-0 p-4 overflow-x-auto">
              <code className="text-emerald-300 font-mono text-xs">{code}</code>
            </pre>
          </div>
        )
      }

      return (
        <p key={index} className="whitespace-pre-wrap leading-relaxed">
          {part.split('**').map((subPart, subIndex) => {
            if (subIndex % 2 === 1) {
              return <strong key={subIndex} className="text-emerald-400 font-semibold">{subPart}</strong>
            }
            return subPart.split('*').map((italicPart, italicIndex) => {
              if (italicIndex % 2 === 1) {
                return <em key={italicIndex} className="text-cyan-400">{italicPart}</em>
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050b0a] text-gray-200">
      
      <aside className="w-[300px] bg-[#0a1412] border-r border-white/5 flex flex-col h-full z-10">
        
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Compass size={20} className="text-white animate-spin" style={{ animationDuration: '20s' }} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-wide text-white">NusaGuide</span>
              <span className="text-[10px] text-emerald-500 font-semibold tracking-wider uppercase">Pemandu Wisata 3D</span>
            </div>
          </div>
          
          <button 
            onClick={handleNewSession}
            className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
            title="Eksplorasi Baru"
          >
            <Plus size={16} className="text-gray-300 group-hover:text-white group-hover:scale-110 transition-all" />
          </button>
        </div>

        <div className="p-4 border-b border-white/5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-3">Pilih Pemandu Wisata</span>
          <div className="grid grid-cols-3 gap-2">
            {GUIDES.map(guide => (
              <button
                key={guide.id}
                onClick={() => {
                  setSelectedGuide(guide.id)
                  if (currentSession) {
                    const updated = sessions.map(s => s.id === activeSessionId ? { ...s, guide: guide.id } : s)
                    setSessions(updated)
                  }
                }}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  selectedGuide === guide.id 
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-white shadow-md shadow-emerald-950/20' 
                    : 'bg-white/[0.01] border-white/5 text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                }`}
              >
                <span className="text-xl">{guide.avatar}</span>
                <span className="text-[10px] font-bold">{guide.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block px-2 mb-2">Destinasi Eksplorasi</span>
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer group transition-all duration-200 ${
                activeSessionId === session.id 
                  ? 'bg-white/[0.03] border border-white/10 text-white' 
                  : 'text-gray-400 hover:bg-white/[0.01] hover:text-gray-200 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin size={15} className={activeSessionId === session.id ? 'text-emerald-400' : 'text-gray-500'} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold truncate">{session.title}</span>
                  <span className="text-[9px] text-emerald-600 font-medium">Pemandu: {session.guide || 'Siti'}</span>
                </div>
              </div>
              
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 text-gray-500 hover:text-red-400 transition-all"
                title="Hapus"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-white/[0.01] border-t border-b border-white/5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Globe size={12} />
            <span>Koneksi Backend:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className={`font-bold uppercase tracking-wider text-[9px] ${connectionStatus === 'live' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {connectionStatus === 'live' ? 'Live API' : 'Sandbox'}
            </span>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
              {user ? user.name[0].toUpperCase() : <User size={15} />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">{user ? user.name : 'Tamu Wisata'}</span>
              <span className="text-[10px] text-gray-500 truncate">{user ? user.email : 'Mode Demo'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              title="Pengaturan"
            >
              <Settings size={15} />
            </button>
            {user && (
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors"
                title="Keluar"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#050b0a] relative">
        
        <div className="absolute top-[-15%] left-[20%] w-[600px] h-[600px] rounded-full bg-emerald-950/10 blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-15%] right-[10%] w-[500px] h-[500px] rounded-full bg-cyan-950/10 blur-[140px] pointer-events-none"></div>

        <header className="h-[64px] border-b border-white/5 flex items-center justify-between px-6 bg-[#050b0a]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="text-2xl flex items-center gap-2">
              <span>{activeGuideData.avatar}</span>
              {isSpeaking && (
                <span className="flex gap-0.5 items-center h-3">
                  <span className="w-0.5 bg-emerald-400 animate-bounce h-2" style={{ animationDelay: '0s', animationDuration: '0.4s' }}></span>
                  <span className="w-0.5 bg-emerald-400 animate-bounce h-3" style={{ animationDelay: '0.1s', animationDuration: '0.5s' }}></span>
                  <span className="w-0.5 bg-emerald-400 animate-bounce h-1" style={{ animationDelay: '0.2s', animationDuration: '0.3s' }}></span>
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <h2 className="text-xs font-bold text-white">{currentSession ? currentSession.title : 'Destinasi Wisata'}</h2>
              <span className="text-[10px] text-emerald-500 font-medium">Pemandu Aktif: {activeGuideData.name} ({activeGuideData.role})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value)
                if (currentSession) {
                  const updated = sessions.map(s => s.id === activeSessionId ? { ...s, model: e.target.value } : s)
                  setSessions(updated)
                }
              }}
              className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-bold text-gray-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Gemini 2.5 Pro" className="bg-[#0a1412] text-white">Gemini 2.5 Pro</option>
              <option value="Gemini 1.5 Flash" className="bg-[#0a1412] text-white">Gemini 1.5 Flash</option>
              <option value="Claude 3.5 Sonnet" className="bg-[#0a1412] text-white">Claude 3.5 Sonnet</option>
            </select>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-6 animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-emerald-900/30">
                    <Compass size={36} className="text-white" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-xl font-bold tracking-tight text-white">Halo! Mau Liburan ke Mana Hari Ini?</h1>
                    <p className="text-xs text-emerald-500/80 font-medium">
                      Saya {activeGuideData.name}, siap membantu Anda merencanakan perjalanan, merekomendasikan kuliner legendaris, dan menjelaskan sejarah destinasi wisata di Indonesia.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full mt-4">
                    <div 
                      onClick={() => setInput('Bagaimana rencana perjalanan 3 hari terbaik di Bali?')}
                      className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-emerald-500/25 hover:bg-white/[0.03] text-left cursor-pointer transition-all duration-200"
                    >
                      <h3 className="text-xs font-bold text-emerald-400 mb-1">Rencana Liburan</h3>
                      <p className="text-[11px] text-gray-400">Rencana itinerary 3 hari mengeksplorasi keindahan alam Bali.</p>
                    </div>
                    <div 
                      onClick={() => setInput('Tolong jelaskan sejarah dan misteri di Candi Borobudur')}
                      className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-emerald-500/25 hover:bg-white/[0.03] text-left cursor-pointer transition-all duration-200"
                    >
                      <h3 className="text-xs font-bold text-cyan-400 mb-1">Sejarah & Budaya</h3>
                      <p className="text-[11px] text-gray-400">Jelajahi filosofi tingkatan candi Buddha terbesar di dunia.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-6">
                  {currentMessages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-4 p-4 rounded-2xl border transition-all animate-fade-in ${
                        msg.role === 'user' 
                          ? 'bg-emerald-950/10 border-emerald-500/10 ml-12 justify-end' 
                          : 'bg-white/[0.01] border-white/5 mr-12'
                      }`}
                    >
                      {msg.role !== 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-md">
                          <Sparkles size={14} className="text-white" />
                        </div>
                      )}
                      
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="text-[9px] font-bold tracking-wider text-emerald-600 uppercase">
                          {msg.role === 'user' ? 'Wisatawan' : activeGuideData.name}
                        </div>
                        <div className="text-xs text-gray-200 overflow-hidden leading-relaxed">
                          {renderMessageContent(msg.content)}
                          
                          {msg.role !== 'user' && renderWidgets(msg.content)}

                          {msg.files && msg.files.length > 0 && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {msg.files.map((file, i) => (
                                <div key={i} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium">
                                  <Paperclip size={10} />
                                  <span>{file.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <User size={14} className="text-emerald-400" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.01] border border-white/5 mr-12 max-w-xs animate-pulse">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-white animate-spin" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="p-6 border-t border-white/5 bg-[#050b0a]/40 backdrop-blur-md z-10">
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept="image/*,video/*"
              />

              {selectedFiles.length > 0 && (
                <div className="max-w-3xl mx-auto flex items-center gap-2.5 p-3 bg-white/[0.02] border border-white/5 rounded-2xl mb-3 animate-fade-in">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center shrink-0">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-[9px] text-emerald-400 font-bold uppercase">Vid</div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 bg-red-500/80 hover:bg-red-600 text-white rounded-bl-lg p-0.5 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <span className="text-[10px] text-gray-500 font-medium ml-1">{selectedFiles.length} File terpilih</span>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-end gap-2 bg-white/5 border border-white/5 focus-within:border-emerald-500/30 focus-within:ring-1 focus-within:ring-emerald-500/10 rounded-2xl p-2 transition-all">
                <button 
                  type="button" 
                  onClick={triggerFileSelect}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Lampirkan Dokumen/Foto Tiket"
                >
                  <Paperclip size={16} />
                </button>

                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between px-3 py-2 bg-emerald-950/15 border border-emerald-500/20 rounded-xl animate-pulse h-[38px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span className="text-[11px] font-bold text-emerald-400 tracking-wide">Perekaman Suara Aktif...</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 h-4">
                        <span className="w-0.5 bg-emerald-400 animate-bounce h-2" style={{ animationDelay: '0.1s', animationDuration: '0.4s' }}></span>
                        <span className="w-0.5 bg-emerald-400 animate-bounce h-4" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></span>
                        <span className="w-0.5 bg-emerald-400 animate-bounce h-3" style={{ animationDelay: '0.3s', animationDuration: '0.5s' }}></span>
                        <span className="w-0.5 bg-emerald-400 animate-bounce h-1" style={{ animationDelay: '0.4s', animationDuration: '0.3s' }}></span>
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center"
                        title="Hentikan dan Kirim"
                      >
                        <Square size={10} fill="white" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage(e)
                      }
                    }}
                    placeholder={`Tanya ${activeGuideData.name} tentang destinasi wisata...`}
                    rows={1}
                    className="flex-1 bg-transparent border-0 resize-none text-xs text-gray-100 placeholder-gray-500 py-2 px-3 focus:outline-none max-h-32 overflow-y-auto font-sans"
                    style={{ height: '38px' }}
                  />
                )}

                {!isRecording && (
                  <button 
                    type="button" 
                    onClick={startRecording}
                    className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Kirim Suara Real-time"
                  >
                    <Mic size={16} />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!input.trim() && selectedFiles.length === 0}
                  className={`p-2.5 rounded-xl transition-all ${
                    input.trim() || selectedFiles.length > 0
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20' 
                      : 'text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                </button>
              </form>
              <div className="text-center text-[10px] text-gray-600 mt-3">
                {connectionStatus === 'live' 
                  ? 'Terhubung dengan API backend Laravel. Percakapan tersimpan di database SQLite.' 
                  : 'Menjalankan Mode Demo. Konfigurasikan koneksi API di pengaturan jika ingin menggunakan mode Live.'}
              </div>
            </footer>
          </div>

          <div className="w-[360px] h-full p-6 border-l border-white/5 flex flex-col hidden lg:flex shrink-0">
            <AvatarCanvas modelUrl={activeGuideData.modelUrl} isSpeaking={isSpeaking} />
          </div>
          
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a1412] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Pengaturan Sistem</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">URL API Backend</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="http://localhost:8000/api"
                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={checkBackendHealth}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <Activity size={12} />
                    Uji
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 my-4"></div>

              {user ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
                    <Check size={18} className="text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Koneksi Aktif</div>
                      <div className="text-[10px] text-gray-400">Masuk sebagai {user.name} ({user.email})</div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                  >
                    Keluar dari Akun
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex border-b border-white/5">
                    <button
                      onClick={() => { setAuthTab('login'); setAuthError(''); }}
                      className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all ${
                        authTab === 'login' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-400'
                      }`}
                    >
                      Masuk (Sign In)
                    </button>
                    <button
                      onClick={() => { setAuthTab('register'); setAuthError(''); }}
                      className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all ${
                        authTab === 'register' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-400'
                      }`}
                    >
                      Daftar (Register)
                    </button>
                  </div>

                  {authError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-red-400">{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-[9px] text-gray-400 uppercase mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          required
                          value={authForm.name}
                          onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                          placeholder="Nama Anda"
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[9px] text-gray-400 uppercase mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder="nama@domain.com"
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400 uppercase mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-[9px] text-gray-400 uppercase mb-1">Konfirmasi Password</label>
                        <input
                          type="password"
                          required
                          value={authForm.password_confirmation}
                          onChange={(e) => setAuthForm({ ...authForm, password_confirmation: e.target.value })}
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Lock size={12} />
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
