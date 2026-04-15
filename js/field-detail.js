import { supabase } from './supabase.js'
import { initNavbar } from './components.js'
import { getCurrentProfile, sendNotification } from './auth.js'
import {
  getParam, formatCurrency, formatDate, formatTime, getSportConfig,
  generateTimeSlots, calcDuration, showToast, setLoading, renderStars,
  getTodayDate
} from './utils.js'

const fieldId = getParam('id')
let field = null
let profile = null
let selectedStartTime = null
let selectedEndTime = null
let selectedRating = 0
let reviewBookingId = null

document.getElementById('year').textContent = new Date().getFullYear()

async function init() {
  if (!fieldId) { window.location.href = '/index.html'; return }
  profile = await initNavbar('home')
  await loadField()
  setupBookingModal()
  setupReviewModal()
}

async function loadField() {
  const container = document.getElementById('pageContent')
  try {
    const { data, error } = await supabase
      .from('fields')
      .select('*, reviews(*, profiles(full_name))')
      .eq('id', fieldId)
      .single()

    if (error || !data) throw new Error('Lapangan tidak ditemukan.')
    field = data
    renderFieldPage()
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="min-height:80vh;justify-content:center;display:flex;flex-direction:column;align-items:center;">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Lapangan Tidak Ditemukan</div>
      <div class="empty-state-text">${err.message}</div>
      <a href="/index.html" class="btn btn-primary" style="margin-top:1.5rem;">← Kembali</a>
    </div>`
  }
}

function getAvgRating(reviews) {
  if (!reviews || reviews.length === 0) return 0
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
}

function renderFieldPage() {
  const cfg = getSportConfig(field.type)
  const avgRating = getAvgRating(field.reviews)
  const reviewCount = field.reviews?.length || 0
  const canBook = profile && profile.role === 'customer'

  document.title = `${field.name} — SportBook`

  const imgSection = field.image_url
    ? `<img src="${field.image_url}" alt="${field.name}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8rem;background:linear-gradient(135deg,var(--clr-surface-2),var(--clr-surface-3));">${cfg.icon}</div>`

  document.getElementById('pageContent').innerHTML = `
    <div>
      <!-- Hero Image -->
      <div style="height:380px;overflow:hidden;background:var(--clr-surface-2);">
        ${imgSection}
      </div>

      <div class="container" style="padding-top:2rem;padding-bottom:4rem;">
        <div style="display:grid;grid-template-columns:1fr 360px;gap:2.5rem;align-items:start;">
          <!-- Left Column -->
          <div>
            <!-- Breadcrumb -->
            <div style="display:flex;align-items:center;gap:0.5rem;color:var(--clr-text-muted);font-size:0.8rem;margin-bottom:1.25rem;">
              <a href="/index.html" style="color:var(--clr-primary);">Beranda</a>
              <span>›</span>
              <span>${field.name}</span>
            </div>

            <!-- Title -->
            <div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
              <div style="flex:1;">
                <span class="badge badge-${field.type}" style="margin-bottom:0.75rem;">${cfg.icon} ${cfg.label}</span>
                <h1 style="font-size:2rem;font-weight:900;margin-bottom:0.5rem;letter-spacing:-0.5px;">${field.name}</h1>
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                  <div style="display:flex;align-items:center;gap:0.5rem;color:var(--clr-accent);">
                    ${avgRating > 0
                      ? `<span style="font-size:1.1rem;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</span>
                         <span style="font-weight:700;">${avgRating.toFixed(1)}</span>
                         <span style="color:var(--clr-text-muted);font-size:0.875rem;">(${reviewCount} review)</span>`
                      : '<span style="color:var(--clr-text-muted);font-size:0.875rem;">Belum ada review</span>'
                    }
                  </div>
                  <div style="color:var(--clr-text-muted);font-size:0.875rem;">🕐 ${formatTime(field.open_time)} – ${formatTime(field.close_time)}</div>
                </div>
              </div>
            </div>

            <!-- Description -->
            ${field.description ? `
              <div class="card" style="margin-bottom:1.5rem;">
                <div class="card-body">
                  <div class="section-title" style="margin-bottom:0.75rem;">📋 Tentang Lapangan</div>
                  <p style="color:var(--clr-text-muted);line-height:1.7;">${field.description}</p>
                </div>
              </div>` : ''}

            <!-- Info Cards -->
            <div class="grid grid-2" style="margin-bottom:1.5rem;gap:1rem;">
              <div class="card">
                <div class="card-body" style="text-align:center;">
                  <div style="font-size:1.75rem;margin-bottom:0.5rem;">💰</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--clr-primary);">${formatCurrency(field.price_per_hour)}</div>
                  <div style="font-size:0.8rem;color:var(--clr-text-muted);">per jam</div>
                </div>
              </div>
              <div class="card">
                <div class="card-body" style="text-align:center;">
                  <div style="font-size:1.75rem;margin-bottom:0.5rem;">⏰</div>
                  <div style="font-size:1.1rem;font-weight:700;">${formatTime(field.open_time)} – ${formatTime(field.close_time)}</div>
                  <div style="font-size:0.8rem;color:var(--clr-text-muted);">jam operasional</div>
                </div>
              </div>
            </div>

            <!-- Reviews -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
                <div class="section-title" style="margin-bottom:0;">⭐ Review Pengguna</div>
                ${canBook ? `<button class="btn btn-outline btn-sm" id="openReviewBtn">Tulis Review</button>` : ''}
              </div>
              ${renderReviews()}
            </div>
          </div>

          <!-- Right Column: Booking Card -->
          <div style="position:sticky;top:calc(var(--navbar-h) + 1.5rem);">
            <div class="card" style="border:1px solid rgba(16,185,129,0.2);box-shadow:0 4px 24px rgba(16,185,129,0.1);">
              <div class="card-body">
                <div style="font-size:1.5rem;font-weight:800;color:var(--clr-primary);margin-bottom:0.25rem;">${formatCurrency(field.price_per_hour)}<span style="font-size:0.875rem;font-weight:400;color:var(--clr-text-muted);"> / jam</span></div>
                <div style="font-size:0.8rem;color:var(--clr-text-muted);margin-bottom:1.5rem;">Harga belum termasuk pajak</div>

                ${canBook
                  ? `<button class="btn btn-primary btn-full btn-lg" id="openBookingBtn">
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
                      Pesan Sekarang
                    </button>`
                  : profile
                    ? `<div style="text-align:center;padding:1rem;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:10px;color:var(--clr-warning);font-size:0.875rem;">Admin tidak dapat melakukan booking</div>`
                    : `<a href="/login.html" class="btn btn-primary btn-full btn-lg">Masuk untuk Booking</a>
                       <a href="/register.html" class="btn btn-ghost btn-full" style="margin-top:0.5rem;">Daftar Gratis →</a>`
                }

                <div class="divider"></div>
                <div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.875rem;">
                  <div style="display:flex;align-items:center;gap:0.5rem;color:var(--clr-text-muted);">
                    <span>✅</span> Konfirmasi instan
                  </div>
                  <div style="display:flex;align-items:center;gap:0.5rem;color:var(--clr-text-muted);">
                    <span>🔒</span> Pembayaran aman & terpercaya
                  </div>
                  <div style="display:flex;align-items:center;gap:0.5rem;color:var(--clr-text-muted);">
                    <span>🔄</span> Dapat dibatalkan sebelum tanggal booking
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  // Setup buttons
  document.getElementById('openBookingBtn')?.addEventListener('click', () => {
    openBookingModal()
  })
  document.getElementById('openReviewBtn')?.addEventListener('click', () => {
    openReviewModal()
  })
}

function renderReviews() {
  const reviews = field.reviews || []
  if (reviews.length === 0) {
    return `<div class="empty-state" style="padding:2rem;text-align:center;color:var(--clr-text-muted);">
      <div style="font-size:2rem;margin-bottom:0.5rem;">💬</div>
      <div>Belum ada review. Jadilah yang pertama!</div>
    </div>`
  }

  return `<div style="display:flex;flex-direction:column;gap:1rem;">
    ${reviews.map(r => `
      <div class="card">
        <div class="card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <div style="width:32px;height:32px;background:linear-gradient(135deg,var(--clr-primary),var(--clr-purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:0.75rem;">
                ${r.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span style="font-weight:600;font-size:0.875rem;">${r.profiles?.full_name || 'Pengguna'}</span>
            </div>
            <div style="color:var(--clr-accent);font-size:0.9rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          </div>
          ${r.comment ? `<p style="font-size:0.875rem;color:var(--clr-text-muted);line-height:1.6;">${r.comment}</p>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`
}

// ============================================================
// BOOKING MODAL
// ============================================================
function openBookingModal() {
  const modal = document.getElementById('bookingModal')
  modal.style.display = 'flex'
  // Set min date to today
  const dateInput = document.getElementById('bookingDate')
  dateInput.min = getTodayDate()
  dateInput.value = getTodayDate()
  updatePriceSummary()
  loadSlotsForDate(dateInput.value)
}

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none'
  selectedStartTime = null
  selectedEndTime = null
}

function setupBookingModal() {
  document.getElementById('closeBookingModal')?.addEventListener('click', closeBookingModal)
  document.getElementById('cancelBookingBtn')?.addEventListener('click', closeBookingModal)
  document.getElementById('bookingModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeBookingModal()
  })

  document.getElementById('bookingDate')?.addEventListener('change', (e) => {
    selectedStartTime = null
    selectedEndTime = null
    document.getElementById('selectedStartTime').value = ''
    document.getElementById('selectedEndTime').value = ''
    loadSlotsForDate(e.target.value)
    updatePriceSummary()
  })

  document.getElementById('durationSelect')?.addEventListener('change', () => {
    selectedStartTime = null
    selectedEndTime = null
    const date = document.getElementById('bookingDate').value
    if (date) loadSlotsForDate(date)
    updatePriceSummary()
  })

  document.getElementById('submitBookingBtn')?.addEventListener('click', submitBooking)
}

async function loadSlotsForDate(date) {
  if (!date || !field) return

  const slotsLoading = document.getElementById('slotsLoading')
  const slotGrid = document.getElementById('slotGrid')

  slotsLoading.style.display = 'block'
  slotGrid.style.display = 'none'
  slotsLoading.textContent = 'Memuat slot tersedia...'

  // Get bookings for this date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time, status')
    .eq('field_id', fieldId)
    .eq('booking_date', date)
    .in('status', ['pending', 'confirmed'])

  const duration = parseInt(document.getElementById('durationSelect').value)
  const slots = generateTimeSlots(field.open_time, field.close_time, duration)

  if (slots.length === 0) {
    slotsLoading.textContent = 'Tidak ada slot tersedia untuk durasi ini.'
    return
  }

  slotGrid.innerHTML = slots.map(slot => {
    const isBooked = (existingBookings || []).some(b => {
      // Check overlap
      const [bs, be] = [b.start_time.slice(0,5), b.end_time.slice(0,5)]
      return !(slot.end <= bs || slot.start >= be)
    })
    return `
      <div class="slot ${isBooked ? 'slot-booked' : ''}" data-start="${slot.start}" data-end="${slot.end}">
        <div style="font-weight:600;">${slot.start}</div>
        <div style="font-size:0.7rem;color:inherit;opacity:0.7;">→ ${slot.end}</div>
      </div>
    `
  }).join('')

  // Slot click
  slotGrid.querySelectorAll('.slot:not(.slot-booked)').forEach(sl => {
    sl.addEventListener('click', () => {
      slotGrid.querySelectorAll('.slot').forEach(s => s.classList.remove('slot-selected'))
      sl.classList.add('slot-selected')
      selectedStartTime = sl.dataset.start
      selectedEndTime = sl.dataset.end
      document.getElementById('selectedStartTime').value = selectedStartTime
      document.getElementById('selectedEndTime').value = selectedEndTime
      updatePriceSummary()
    })
  })

  slotsLoading.style.display = 'none'
  slotGrid.style.display = 'grid'
}

function updatePriceSummary() {
  if (!field) return
  const duration = parseInt(document.getElementById('durationSelect').value)
  const total = field.price_per_hour * duration
  document.getElementById('pricePerHour').textContent = formatCurrency(field.price_per_hour)
  document.getElementById('summaryDuration').textContent = `${duration} jam`
  document.getElementById('totalPrice').textContent = formatCurrency(total)
}

async function submitBooking() {
  const btn = document.getElementById('submitBookingBtn')
  const errEl = document.getElementById('bookingError')
  errEl.style.display = 'none'

  const date = document.getElementById('bookingDate').value
  const notes = document.getElementById('bookingNotes').value.trim()
  const duration = parseInt(document.getElementById('durationSelect').value)

  if (!date) { errEl.textContent = 'Pilih tanggal booking.'; errEl.style.display = 'block'; return }
  if (!selectedStartTime) { errEl.textContent = 'Pilih jam mulai.'; errEl.style.display = 'block'; return }
  if (!profile) { errEl.textContent = 'Kamu harus masuk terlebih dahulu.'; errEl.style.display = 'block'; return }

  const totalPrice = field.price_per_hour * duration

  setLoading(btn, true, 'Konfirmasi Booking')
  try {
    const { error } = await supabase.from('bookings').insert({
      user_id: profile.id,
      field_id: fieldId,
      booking_date: date,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      duration_hours: duration,
      total_price: totalPrice,
      notes: notes || null,
      status: 'pending'
    })

    if (error) throw error

    // Send notification to user
    await sendNotification(
      profile.id,
      '📋 Booking Baru Dibuat',
      `Booking ${field.name} pada ${formatDate(date)} jam ${selectedStartTime} berhasil dibuat. Total: ${formatCurrency(totalPrice)}. Silakan lakukan pembayaran.`,
      'booking'
    )

    showToast('Booking berhasil dibuat! 🎉', 'success')
    closeBookingModal()
    setTimeout(() => { window.location.href = '/my-bookings.html' }, 1200)
  } catch (err) {
    errEl.textContent = err.message || 'Gagal membuat booking. Coba lagi.'
    errEl.style.display = 'block'
  } finally {
    setLoading(btn, false, 'Konfirmasi Booking')
  }
}

// ============================================================
// REVIEW MODAL
// ============================================================
function openReviewModal() {
  if (!profile) { window.location.href = '/login.html'; return }
  selectedRating = 0
  document.getElementById('ratingValue').value = 0
  document.getElementById('reviewComment').value = ''
  document.getElementById('reviewError').style.display = 'none'
  updateStarDisplay(0)
  document.getElementById('reviewModal').style.display = 'flex'
}

function setupReviewModal() {
  document.getElementById('closeReviewModal')?.addEventListener('click', () => {
    document.getElementById('reviewModal').style.display = 'none'
  })
  document.getElementById('cancelReviewBtn')?.addEventListener('click', () => {
    document.getElementById('reviewModal').style.display = 'none'
  })
  document.getElementById('reviewModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('reviewModal').style.display = 'none'
  })

  // Star rating
  document.querySelectorAll('#ratingStars .star').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value)
      document.getElementById('ratingValue').value = selectedRating
      updateStarDisplay(selectedRating)
    })
    star.addEventListener('mouseenter', () => updateStarDisplay(parseInt(star.dataset.value)))
    star.addEventListener('mouseleave', () => updateStarDisplay(selectedRating))
  })

  document.getElementById('submitReviewBtn')?.addEventListener('click', submitReview)
}

function updateStarDisplay(rating) {
  document.querySelectorAll('#ratingStars .star').forEach((s, i) => {
    s.style.color = i < rating ? 'var(--clr-accent)' : 'var(--clr-border-light)'
  })
}

async function submitReview() {
  const btn = document.getElementById('submitReviewBtn')
  const errEl = document.getElementById('reviewError')
  errEl.style.display = 'none'

  if (selectedRating === 0) {
    errEl.textContent = 'Pilih rating bintang terlebih dahulu.'
    errEl.style.display = 'block'
    return
  }

  const comment = document.getElementById('reviewComment').value.trim()
  setLoading(btn, true, 'Kirim Review')

  try {
    const { error } = await supabase.from('reviews').insert({
      user_id: profile.id,
      field_id: fieldId,
      booking_id: reviewBookingId || null,
      rating: selectedRating,
      comment: comment || null
    })

    if (error) throw error
    showToast('Review berhasil dikirim! ⭐', 'success')
    document.getElementById('reviewModal').style.display = 'none'
    await loadField()
  } catch (err) {
    let msg = err.message || 'Gagal mengirim review.'
    if (err.code === '23505') msg = 'Kamu sudah pernah memberi review untuk booking ini.'
    errEl.textContent = msg
    errEl.style.display = 'block'
  } finally {
    setLoading(btn, false, 'Kirim Review')
  }
}

init()
