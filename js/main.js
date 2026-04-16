import { supabase } from './supabase.js'
import { initNavbar } from './components.js'
import { formatCurrency, getSportConfig, debounce, showToast, truncate } from './utils.js'

// Scroll-based navbar
window.addEventListener('scroll', () => {
  document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 20)
})

// Set year
document.getElementById('year').textContent = new Date().getFullYear()

let allFields = []
let activeType = 'all'
let searchQuery = ''

async function init() {
  await initNavbar('home')
  await loadStats()
  await loadFields()
  setupFilters()
}

async function loadStats() {
  try {
    const { count: fieldCount } = await supabase
      .from('fields').select('id', { count: 'exact', head: true }).eq('is_active', true)

    const { count: bookingCount } = await supabase
      .from('bookings').select('id', { count: 'exact', head: true })

    document.getElementById('statFields').textContent = fieldCount ?? 0
    document.getElementById('statBookings').textContent = bookingCount ?? 0
  } catch (_) {}
}

async function loadFields() {
  const grid = document.getElementById('fieldsGrid')
  try {
    const { data, error } = await supabase
      .from('fields')
      .select('*, reviews(rating)')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    allFields = data || []
    renderFields()
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Gagal memuat lapangan</div>
      <div class="empty-state-text">${err.message}</div>
    </div>`
  }
}

function getAvgRating(reviews) {
  if (!reviews || reviews.length === 0) return 0
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
}

function renderFields() {
  const grid = document.getElementById('fieldsGrid')
  const sortVal = document.getElementById('sortSelect').value

  let filtered = allFields.filter(f => {
    const matchType = activeType === 'all' || f.type === activeType
    const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery) || f.type.toLowerCase().includes(searchQuery)
    return matchType && matchSearch
  })

  // Sort
  if (sortVal === 'price_asc') filtered.sort((a, b) => a.price_per_hour - b.price_per_hour)
  else if (sortVal === 'price_desc') filtered.sort((a, b) => b.price_per_hour - a.price_per_hour)
  else if (sortVal === 'rating') filtered.sort((a, b) => getAvgRating(b.reviews) - getAvgRating(a.reviews))
  else filtered.sort((a, b) => a.name.localeCompare(b.name))

  document.getElementById('resultsCount').textContent =
    filtered.length === 0 ? 'Tidak ada lapangan ditemukan' : `Menampilkan ${filtered.length} lapangan`

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-title">Lapangan tidak ditemukan</div>
      <div class="empty-state-text">Coba ubah filter atau kata kunci pencarian kamu.</div>
    </div>`
    return
  }

  grid.innerHTML = filtered.map(f => createFieldCard(f)).join('')

  // Add click listeners
  grid.querySelectorAll('.field-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `/field-detail.html?id=${card.dataset.id}`
    })
  })
}

function createFieldCard(field) {
  const cfg = getSportConfig(field.type)
  const avgRating = getAvgRating(field.reviews)
  const reviewCount = field.reviews?.length || 0
  const stars = avgRating > 0
    ? `${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}`
    : '☆☆☆☆☆'

  const imgHtml = field.image_url
    ? `<img src="${field.image_url}" alt="${field.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:4rem;background:linear-gradient(135deg,var(--clr-surface-2),var(--clr-surface-3));">${cfg.icon}</div>`
    : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:4rem;background:linear-gradient(135deg,var(--clr-surface-2),var(--clr-surface-3));">${cfg.icon}</div>`

  return `
    <div class="field-card animate-fade-in" data-id="${field.id}" role="button" tabindex="0">
      <div class="field-card-image">
        ${imgHtml}
        <span class="badge badge-${field.type} field-type-badge">${cfg.icon} ${cfg.label}</span>
      </div>
      <div class="field-card-body">
        <div class="field-card-name">${field.name}</div>
        ${field.location ? `<div style="font-size:0.75rem;color:var(--clr-text-muted);display:flex;align-items:center;gap:0.25rem;margin-bottom:0.25rem;line-height:1.4;">📍 ${truncate(field.location, 50)}</div>` : ''}
        <div class="field-card-type">${field.description ? truncate(field.description, 60) : `Lapangan ${cfg.label} profesional`}</div>
        <div class="field-card-meta">
          <div class="field-card-price">${formatCurrency(field.price_per_hour)} <span>/jam</span></div>
          <div style="font-size:0.8rem;color:var(--clr-accent);">
            ${avgRating > 0 ? `${stars} <span style="color:var(--clr-text-muted);">(${reviewCount})</span>` : '<span style="color:var(--clr-text-muted);">Belum ada review</span>'}
          </div>
        </div>
        <div class="field-card-footer">
          <span>🕐 ${field.open_time?.slice(0,5)} – ${field.close_time?.slice(0,5)}</span>
          <span style="color:var(--clr-primary);font-weight:600;font-size:0.8rem;">Pesan →</span>
        </div>
      </div>
    </div>
  `
}

function setupFilters() {
  // Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      activeType = chip.dataset.type
      renderFields()
    })
  })

  // Search
  const searchHandler = debounce((e) => {
    searchQuery = e.target.value.toLowerCase().trim()
    renderFields()
  }, 300)
  document.getElementById('searchInput').addEventListener('input', searchHandler)

  // Sort
  document.getElementById('sortSelect').addEventListener('change', renderFields)
}

init()
