// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// --- Toast Notifications ---
let toastContainer = null

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer()
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `

  container.appendChild(toast)
  setTimeout(() => toast.classList.add('toast-show'), 10)

  setTimeout(() => {
    toast.classList.remove('toast-show')
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// --- Currency Format ---
export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// --- Date & Time Formatters ---
export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '-'
  const dStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
  const date = new Date(dStr)
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function formatTime(timeStr) {
  if (!timeStr) return '-'
  const [h, m] = timeStr.split(':')
  return `${h}:${m}`
}

export function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// --- Loading State ---
export function setLoading(btn, loading, text = 'Simpan') {
  if (loading) {
    btn.disabled = true
    btn.innerHTML = `<span class="spinner-sm"></span> Memproses...`
  } else {
    btn.disabled = false
    btn.innerHTML = text
  }
}

// --- Status Badge ---
export function getStatusBadge(status) {
  const map = {
    pending: { label: 'Menunggu', class: 'badge-warning' },
    confirmed: { label: 'Dikonfirmasi', class: 'badge-success' },
    cancelled: { label: 'Dibatalkan', class: 'badge-danger' },
    completed: { label: 'Selesai', class: 'badge-info' },
    verified: { label: 'Terverifikasi', class: 'badge-success' },
    rejected: { label: 'Ditolak', class: 'badge-danger' }
  }
  const s = map[status] || { label: status, class: 'badge-secondary' }
  return `<span class="badge ${s.class}">${s.label}</span>`
}

// --- Star Rating HTML ---
export function renderStars(rating, interactive = false, fieldId = '') {
  let html = '<div class="stars">'
  for (let i = 1; i <= 5; i++) {
    if (interactive) {
      html += `<span class="star ${i <= rating ? 'active' : ''}" data-value="${i}" data-field="${fieldId}">★</span>`
    } else {
      html += `<span class="star ${i <= rating ? 'active' : ''}">★</span>`
    }
  }
  html += '</div>'
  return html
}

// --- CSV Export ---
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) {
    showToast('Tidak ada data untuk di-export', 'warning')
    return
  }

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] ?? ''
        const str = String(val).replace(/"/g, '""')
        return str.includes(',') || str.includes('\n') ? `"${str}"` : str
      }).join(',')
    )
  ]

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  showToast(`File ${filename} berhasil diunduh`, 'success')
}

// --- Debounce ---
export function debounce(fn, delay = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// --- Get URL Param ---
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key)
}

// --- Sport Type Icons & Colors ---
export const sportConfig = {
  futsal: { icon: '⚽', color: '#10b981', label: 'Futsal' },
  basket: { icon: '🏀', color: '#f59e0b', label: 'Basket' },
  badminton: { icon: '🏸', color: '#3b82f6', label: 'Badminton' },
  tenis: { icon: '🎾', color: '#8b5cf6', label: 'Tenis' },
  voli: { icon: '🏐', color: '#ef4444', label: 'Voli' },
  renang: { icon: '🏊', color: '#06b6d4', label: 'Renang' },
  lainnya: { icon: '🏟️', color: '#6b7280', label: 'Lainnya' }
}

export function getSportConfig(type) {
  return sportConfig[type] || sportConfig.lainnya
}

// --- Calculate Duration in Hours ---
export function calcDuration(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60
}

// --- Generate Time Slots ---
export function generateTimeSlots(openTime, closeTime, intervalHours = 1) {
  const slots = []
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)

  let current = oh * 60 + om
  const end = ch * 60 + cm

  while (current + intervalHours * 60 <= end) {
    const startH = String(Math.floor(current / 60)).padStart(2, '0')
    const startM = String(current % 60).padStart(2, '0')
    const nextMin = current + intervalHours * 60
    const endH = String(Math.floor(nextMin / 60)).padStart(2, '0')
    const endM = String(nextMin % 60).padStart(2, '0')
    slots.push({ start: `${startH}:${startM}`, end: `${endH}:${endM}` })
    current += intervalHours * 60
  }
  return slots
}

// --- Truncate Text ---
export function truncate(text, maxLen = 100) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

// --- Check if date is past ---
export function isPast(dateStr) {
  return new Date(dateStr) < new Date(getTodayDate())
}
