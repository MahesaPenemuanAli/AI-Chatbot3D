export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_ATTACHMENT_COUNT = 4
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/flac,audio/aac,audio/mp4,audio/webm,video/mp4,video/webm,video/quicktime,video/mpeg,video/3gpp'
const ALLOWED_TYPES = new Set(ATTACHMENT_ACCEPT.split(','))

export function getAccountScope(account, backendUrl) {
  if (account?.id === undefined || account?.id === null) return null
  try {
    const url = new URL(backendUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}::${String(account.id)}`
  } catch { return null }
}

export function isSessionVisible(session, accountScope) {
  return session.mode === 'demo' || (Boolean(accountScope) && session.mode === 'live' && session.accountScope === accountScope)
}

export function validateAttachmentFiles(files, existing = []) {
  if (existing.length + files.length > MAX_ATTACHMENT_COUNT) return `Maksimal ${MAX_ATTACHMENT_COUNT} lampiran dalam satu pesan.`
  if (files.some(file => !ALLOWED_TYPES.has(file.type))) return 'Gunakan gambar JPG, PNG, WebP, GIF, AVIF, HEIC; rekaman audio; atau video MP4, WebM, MOV, MPEG, 3GP.'
  if (files.some(file => !file.size)) return 'Lampiran kosong tidak dapat dikirim. Pilih berkas lain.'
  if (files.some(file => file.size > MAX_ATTACHMENT_BYTES)) return 'Ukuran setiap lampiran maksimal 20 MB.'
  const total = [...existing.map(item => item.file || item), ...files].reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_ATTACHMENT_BYTES) return 'Total ukuran lampiran dalam satu pesan maksimal 20 MB.'
  return ''
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function toServerAttachment(attachment, backendUrl) {
  const name = attachment.file_name || attachment.name || 'Lampiran'
  const type = attachment.mime_type || attachment.type || ''
  let url = null
  const path = attachment.file_path
  // Media previews must remain within the selected API's own storage directory.
  if (typeof path === 'string' && /^storage\/attachments\/[\w./-]+$/.test(path) && !path.split('/').includes('..')) {
    try {
      const api = new URL(`${backendUrl.replace(/\/+$/, '')}/`)
      const candidate = new URL(path, new URL('../', api))
      if (candidate.origin === api.origin) url = candidate.href
    } catch { /* The filename is still useful if a media URL cannot be resolved. */ }
  }
  return { id: String(attachment.id || name), name, type, size: attachment.file_size || attachment.size || 0, url }
}

export function serializeSessions(sessions) {
  return sessions.slice(0, 40).map(session => ({
    ...session,
    messages: session.messages.map(message => ({
      ...message,
      attachments: (message.attachments || []).map(({ id, name, type, size, url }) => ({ id, name, type, size, url: typeof url === 'string' && /^https?:\/\//.test(url) ? url : null })),
      uploadState: message.uploadState === 'sending' ? 'interrupted' : message.uploadState,
    })),
  }))
}
