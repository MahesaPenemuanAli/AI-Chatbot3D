export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_ATTACHMENT_COUNT = 4
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/flac,audio/x-flac,audio/aac,audio/mp4,audio/webm,video/mp4,video/webm,video/quicktime,video/mpeg,video/3gpp'
const ALLOWED_TYPES = new Set(ATTACHMENT_ACCEPT.split(','))
export const DEFAULT_UPLOAD_LIMITS = { max_attachment_bytes: MAX_ATTACHMENT_BYTES, max_total_attachment_bytes: MAX_ATTACHMENT_BYTES, max_attachment_count: MAX_ATTACHMENT_COUNT }

export function getUploadLimits(serverLimits) {
  return Object.fromEntries(Object.entries(DEFAULT_UPLOAD_LIMITS).map(([key, fallback]) => [key, Number.isFinite(serverLimits?.[key]) && serverLimits[key] >= 0 ? Math.min(fallback, Math.floor(serverLimits[key])) : fallback]))
}

export function restoreSessions(data) {
  if (!Array.isArray(data)) return []
  return data.filter(session => session && typeof session.id === 'string' && typeof session.title === 'string' && (session.mode === 'demo' || (session.mode === 'live' && typeof session.accountScope === 'string')) && Array.isArray(session.messages)).map(session => ({
    id: session.id, title: session.title, mode: session.mode, accountScope: session.mode === 'live' ? session.accountScope : null, updated: Number.isFinite(session.updated) ? session.updated : 0,
    messages: session.messages.filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').map((message, index) => ({
      id: String(message.id ?? `${session.id}-${index}`), role: message.role, content: message.content,
      uploadState: message.uploadState === 'sending' ? 'interrupted' : ['sent', 'failed', 'canceled', 'interrupted'].includes(message.uploadState) ? message.uploadState : undefined,
      attachments: (Array.isArray(message.attachments) ? message.attachments : []).filter(attachment => attachment && typeof attachment.name === 'string').map(attachment => ({ id: String(attachment.id ?? attachment.name), name: attachment.name, type: typeof attachment.type === 'string' ? attachment.type : '', size: Number.isFinite(attachment.size) && attachment.size >= 0 ? attachment.size : 0, url: null })),
    })),
  }))
}

export function getInitialBackendUrl(savedUrl, defaultUrl = '/api') {
  const saved = typeof savedUrl === 'string' ? savedUrl.trim() : ''
  // Earlier versions saved the developer's machine as the API address. A
  // relative default also works when this UI is opened from another device.
  if (!saved || /^https?:\/\/(localhost|127\.0\.0\.1):8000\/api\/*$/i.test(saved)) {
    try { return normalizeBackendUrl(defaultUrl) } catch { return '/api' }
  }
  try { return normalizeBackendUrl(saved) } catch { return '/api' }
}

export function normalizeBackendUrl(value, origin = globalThis.location?.origin) {
  const address = typeof value === 'string' ? value.trim() : ''
  if (!address || /[\\\s]/.test(address) || address.startsWith('//') || (!address.startsWith('/') && !/^https?:\/\//i.test(address))) throw new Error('Gunakan jalur seperti /api atau alamat lengkap http:// atau https://.')
  const url = new URL(address, origin || 'http://localhost')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Alamat layanan tidak boleh memuat akun, kata sandi, parameter, atau fragmen.')
  if (origin?.startsWith('https:') && url.protocol !== 'https:') throw new Error('Gunakan HTTPS agar koneksi akun tetap terlindungi.')
  return address.startsWith('/') ? url.pathname.replace(/\/+$/, '') || '/' : `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

export function getServiceKey(backendUrl, origin = globalThis.location?.origin) {
  const url = new URL(normalizeBackendUrl(backendUrl, origin), origin)
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

function resolveApiUrl(backendUrl, origin = globalThis.location?.origin) {
  const url = new URL(backendUrl, origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid API address')
  return url
}

export function getAccountScope(account, backendUrl, origin) {
  if (!account || !['number', 'string'].includes(typeof account.id) || String(account.id).trim() === '') return null
  try {
    return `${getServiceKey(backendUrl, origin)}::${String(account.id)}`
  } catch { return null }
}

export function restoreAccount(saved, backendUrl, origin) {
  try {
    if (saved?.service !== getServiceKey(backendUrl, origin) || typeof saved.token !== 'string' || !saved.token || !getAccountScope(saved.user, backendUrl, origin) || typeof saved.user.name !== 'string' || typeof saved.user.email !== 'string') return null
    return { token: saved.token, user: saved.user }
  } catch { return null }
}

export function hydrateSession(session, history, accountScope, backendUrl, origin) {
  if (!session || !['number', 'string'].includes(typeof session.id) || !Array.isArray(history)) return null
  return {
    id: String(session.id), title: typeof session.title === 'string' && session.title ? session.title : 'Perjalanan tersimpan', mode: 'live', accountScope,
    messages: history.filter(message => message && typeof message.content === 'string' && ['user', 'assistant', 'model'].includes(message.role)).map((message, index) => ({
      id: String(message.id ?? `${session.id}-${index}`), role: message.role === 'model' ? 'assistant' : message.role, content: message.content,
      attachments: (Array.isArray(message.attachments) ? message.attachments : []).filter(attachment => attachment && typeof attachment === 'object').map(attachment => toServerAttachment(attachment, backendUrl, origin)),
    })), updated: Date.parse(session.updated_at) || 0,
  }
}

export function isSessionVisible(session, accountScope) {
  return session.mode === 'demo' || (Boolean(accountScope) && session.mode === 'live' && session.accountScope === accountScope)
}

export function validateAttachmentFiles(files, existing = [], limits = DEFAULT_UPLOAD_LIMITS) {
  const { max_attachment_bytes: maxBytes, max_total_attachment_bytes: maxTotal, max_attachment_count: maxCount } = getUploadLimits(limits)
  if (existing.length + files.length > maxCount) return `Maksimal ${maxCount} lampiran dalam satu pesan.`
  if (files.some(file => !ALLOWED_TYPES.has(file.type))) return 'Gunakan gambar JPG, PNG, WebP, HEIC, HEIF; audio MPEG, WAV, OGG, FLAC, AAC, MP4, WebM; atau video MP4, WebM, MOV, MPEG, 3GP. Ubah GIF atau AVIF menjadi JPG/PNG terlebih dahulu.'
  if (files.some(file => !file.size)) return 'Lampiran kosong tidak dapat dikirim. Pilih berkas lain.'
  if (files.some(file => file.size > maxBytes)) return `Ukuran setiap lampiran maksimal ${formatFileSize(maxBytes)}.`
  const total = [...existing.map(item => item.file || item), ...files].reduce((sum, file) => sum + file.size, 0)
  if (total > maxTotal) return `Total ukuran lampiran dalam satu pesan maksimal ${formatFileSize(maxTotal)}.`
  return ''
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes === 0) return '0 KB'
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function toServerAttachment(rawAttachment, backendUrl, origin) {
  const attachment = rawAttachment && typeof rawAttachment === 'object' ? rawAttachment : {}
  const name = typeof attachment.file_name === 'string' ? attachment.file_name : typeof attachment.name === 'string' ? attachment.name : 'Lampiran'
  const type = typeof attachment.mime_type === 'string' ? attachment.mime_type : typeof attachment.type === 'string' ? attachment.type : ''
  let url = null
  // Only the owner API can mint temporary preview links. Never render a
  // provider-supplied remote address or the former public storage path.
  const download = attachment.download_url
  if (typeof download === 'string' && download && !download.startsWith('//') && !/[\\\s]/.test(download)) {
    try {
      const api = resolveApiUrl(`${backendUrl.replace(/\/+$/, '')}/`, origin)
      const candidate = new URL(download, api.origin)
      const expectedPath = `${api.pathname.replace(/\/+$/, '')}/chat/attachments/`
      if (candidate.origin === api.origin && candidate.pathname.startsWith(expectedPath) && /^\d+$/.test(candidate.pathname.slice(expectedPath.length)) && candidate.searchParams.has('expires') && /^[a-f0-9]{64}$/i.test(candidate.searchParams.get('signature') || '')) url = candidate.href
    } catch { /* The filename is still useful if a media URL cannot be resolved. */ }
  }
  const size = attachment.file_size ?? attachment.size
  return { id: String(attachment.id || name), name, type, size: Number.isFinite(size) && size >= 0 ? size : 0, url }
}

export function mergeRemoteSessions(localSessions, remoteSessions, protectedSessionId = null) {
  const refreshed = localSessions.map(local => {
    const server = remoteSessions.find(session => session.id === local.id && session.accountScope === local.accountScope)
    if (!server) return local
    if (server.updated > local.updated && local.id !== protectedSessionId) return server
    const attachments = server.messages.flatMap(message => message.attachments)
    return { ...local, messages: local.messages.map(message => ({ ...message, attachments: (message.attachments || []).map(attachment => attachments.find(item => item.id === attachment.id) || attachment) })) }
  })
  return [...refreshed, ...remoteSessions.filter(session => !localSessions.some(local => local.id === session.id && local.accountScope === session.accountScope))]
}

export function serializeSessions(sessions) {
  return [...sessions].sort((a, b) => b.updated - a.updated).slice(0, 40).map(session => ({
    ...session,
    messages: session.messages.map(message => ({
      ...message,
      // Temporary signed links are renewed after account verification; do not
      // retain them on disk as permanently usable public media addresses.
      attachments: (message.attachments || []).map(({ id, name, type, size }) => ({ id, name, type, size, url: null })),
      uploadState: message.uploadState === 'sending' ? 'interrupted' : message.uploadState,
    })),
  }))
}
