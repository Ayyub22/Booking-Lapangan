import { supabase } from './supabase.js'
import { initNavbar } from './components.js'
import { requireCustomer } from './auth.js'
import { formatCurrency, formatDate, formatTime, getStatusBadge, showToast } from './utils.js'

document.getElementById('year').textContent = new Date().getFullYear()

let profile = null
let activeStatus = 'all'
let cancelTargetId = null

async function init() {
  profile = await requireCustomer()
  if (!profile) return
  await initNavbar('bookings')
  setupTabs()
  await loadBookings()
  setupCancelModal()
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      activeStatus = btn.dataset.status
      loadBookings()
    })
  })
}

async function loadBookings() {
  const list = document.getElementById('bookingList')
  list.innerHTML = `<div class="page-loading"><div class="spinner"></div><span>Memuat...</span></div>`

  try {
    let query = supabase
      .from('bookings')
      .select('*, fields(name, type, image_url, price_per_hour), payments(status)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })

    if (activeStatus !== 'all') {
      query = query.eq('status', activeStatus)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Belum ada booking</div>
        <div class="empty-state-text">Kamu belum memiliki booking ${activeStatus !== 'all' ? 'dengan status ini' : ''}. Yuk booking lapangan sekarang!</div>
        <a href="/index.html" class="btn btn-primary" style="margin-top:1.5rem;">Lihat Lapangan →</a>
      </div>`
      return
    }

    list.innerHTML = data.map(b => renderBookingCard(b)).join('')

    // Attach action listeners
    list.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `/booking-detail.html?id=${btn.dataset.id}`
      })
    })

    list.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => openCancelModal(btn.dataset.id, btn.dataset.name, btn.dataset.date))
    })
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Gagal memuat booking</div><div class="empty-state-text">${err.message}</div></div>`
  }
}

function renderBookingCard(b) {
  const field = b.fields
  const payment = b.payments?.[0]
  const { icon } = getSportConfigLocal(field?.type)
  const canCancel = b.status === 'pending' || b.status === 'confirmed'
  const needPayment = b.status === 'pending' && !payment

  return `
    <div class="booking-card" style="margin-bottom:1rem;display:flex;gap:1.25rem;flex-wrap:wrap;">
      <!-- Field Image -->
      <div style="width:100px;height:90px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">
        ${field?.image_url
          ? `<img src="${field.image_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:2rem;">${icon}</div>`
          : icon
        }
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:200px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">
          <div style="font-weight:700;font-size:1rem;">${field?.name || 'Lapangan'}</div>
          ${getStatusBadge(b.status)}
        </div>
        <div style="color:var(--clr-text-muted);font-size:0.8rem;display:flex;flex-direction:column;gap:0.3rem;">
          <div>📅 ${formatDate(b.booking_date)}</div>
          <div>🕐 ${formatTime(b.start_time)} – ${formatTime(b.end_time)} (${b.duration_hours} jam)</div>
          <div>💰 <strong style="color:var(--clr-primary);">${formatCurrency(b.total_price)}</strong></div>
          ${payment ? `<div>💳 Pembayaran: ${getStatusBadge(payment.status)}</div>` : ''}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;flex-direction:column;gap:0.5rem;justify-content:center;min-width:130px;">
        <button class="btn btn-outline btn-sm detail-btn" data-id="${b.id}">Lihat Detail</button>
        ${needPayment ? `<button class="btn btn-warning btn-sm detail-btn" data-id="${b.id}" style="font-size:0.75rem;">💳 Bayar</button>` : ''}
        ${canCancel ? `<button class="btn btn-ghost btn-sm cancel-btn" data-id="${b.id}" data-name="${field?.name || ''}" data-date="${b.booking_date}" style="color:var(--clr-danger);">Batalkan</button>` : ''}
      </div>
    </div>
  `
}

function getSportConfigLocal(type) {
  const icons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }
  return { icon: icons[type] || '🏟️' }
}

// Cancel modal
function openCancelModal(id, name, date) {
  cancelTargetId = id
  document.getElementById('cancelBookingInfo').innerHTML = `
    <strong>${name}</strong><br>
    <span style="color:var(--clr-text-muted);">📅 ${formatDate(date)}</span>
  `
  document.getElementById('cancelModal').style.display = 'flex'
}

function setupCancelModal() {
  document.getElementById('closeCancelModal').addEventListener('click', () => {
    document.getElementById('cancelModal').style.display = 'none'
  })
  document.getElementById('keepBookingBtn').addEventListener('click', () => {
    document.getElementById('cancelModal').style.display = 'none'
  })
  document.getElementById('confirmCancelBtn').addEventListener('click', async () => {
    if (!cancelTargetId) return
    const btn = document.getElementById('confirmCancelBtn')
    btn.disabled = true
    btn.textContent = 'Membatalkan...'
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', cancelTargetId)

      if (error) throw error
      showToast('Booking berhasil dibatalkan.', 'success')
      document.getElementById('cancelModal').style.display = 'none'
      loadBookings()
    } catch (err) {
      showToast('Gagal membatalkan booking: ' + err.message, 'error')
    } finally {
      btn.disabled = false
      btn.textContent = 'Ya, Batalkan'
    }
  })
}

init()
