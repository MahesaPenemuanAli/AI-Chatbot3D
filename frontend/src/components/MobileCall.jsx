import { AudioLines, ChevronDown, ChevronUp, Hand, MessageCircle } from 'lucide-react'
import AvatarCanvas from './AvatarCanvas'
import ErrorBoundary from './ErrorBoundary'
import NusaPortrait from './NusaPortrait'
import NusaMark from './NusaMark'
import './MobileCall.css'

export function MobileCallStage({ avatarStatus, speaking, status, listening, speechActivity, greeting, paused }) {
  return <section className="chat-call-stage" aria-label="Nusa, teman AI 3D dari kepala sampai lutut">
    <div className="chat-call-light" aria-hidden="true"/>
    <div className="chat-call-landscape" aria-hidden="true"><i/><i/><i/></div>
    <div className="chat-call-identity"><span><i/> TEMAN NGOBROLMU</span><h2>Nusa<span>.</span></h2><p>{avatarStatus}</p><span className="chat-call-ai-label"><AudioLines size={12}/> Karakter AI</span></div>
    <div className="chat-call-avatar"><ErrorBoundary fallback={<NusaPortrait framing="conversation"/>}><AvatarCanvas framing="conversation" isSpeaking={speaking} isResponding={status === 'responding'} isThinking={status === 'thinking'} isListening={listening} speechActivity={speechActivity} greeting={greeting} paused={paused}/></ErrorBoundary></div>
  </section>
}

export function MobileCallDock({ open, onToggle, onGreet, messages, status, listening }) {
  const assistant = messages.findLast(message => message.role === 'assistant')
  const busy = status !== 'idle'
  const excerpt = assistant?.content?.replace(/\*\*|\*|#{1,6}\s|https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  return <div className="chat-call-dock">
    {!open && (listening || busy || excerpt) && <div className="chat-call-caption">
      {listening ? <p className="chat-call-caption-state"><AudioLines size={18}/> Aku mendengarkan. Ceritakan idemu.</p>
        : status === 'thinking' ? <p className="chat-call-caption-state" role="status"><span className="chat-call-thinking"><i/><i/><i/></span>Nusa sedang merangkai ide…</p>
          : excerpt ? <><div className="chat-call-caption-heading"><span><NusaMark size={17}/> NUSA</span><button type="button" onClick={onToggle}>Baca lengkap <ChevronUp size={14}/></button></div><p className="chat-call-excerpt">{excerpt.length > 250 ? excerpt.slice(0, 247) + '…' : excerpt}</p></>
            : <p className="chat-call-caption-state"><AudioLines size={18}/> Nusa sedang menjawab…</p>}
    </div>}
    <div className="chat-call-toolbar"><button type="button" className={open ? 'is-active' : ''} aria-controls="nusa-conversation" aria-expanded={open} onClick={onToggle}><MessageCircle size={17}/><span>{open ? 'Tutup percakapan' : 'Percakapan'}</span>{messages.length > 0 && <span className="chat-call-message-count">{messages.length}</span>}{open ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button><button type="button" onClick={onGreet} disabled={busy || listening} aria-label="Sapa Nusa"><Hand size={17}/><span>Sapa Nusa</span></button></div>
  </div>
}
