import { supabase } from '../supabase.js'
import { initAdminSidebar } from '../components.js'
import { requireAdmin, sendNotification } from '../auth.js'
import { formatCurrency, formatDateShort, formatTime, getStatusBadge, showToast, setLoading } from '../utils.js'

let profile = null
let allPayments = []
let activeTab = 'pending'
let selectedPaymentId = null
let selectedPayment = null

async function init() {
  profile = await requireAdmin()
  if (!profile) return
  initAdminSidebar('payments')
  await loadPayments()
  setupTabs()
  setupDetailModal()
}

async function loadPayments() {
  const container = document.getElementById('paymentsContainer')
  container.innerHTML = '<div class="page-loading" style="min-height:200px;"><div class="spinner"></div></div>'
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, bookings(*, profiles(full_name, phone), fields(name, type, price_per_hour))')
      .order('created_at', { ascending: false })
    if (error) throw error
    allPayments = data || []
    renderPayments()
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><div class="empty-state-icon">⚠️</div><div>${err.message}</div></div>`
  }
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      activeTab = btn.dataset.status
      renderPayments()
    })
  })
}

function renderPayments() {
  const container = document.getElementById('paymentsContainer')
  const filtered = activeTab === 'all' ? allPayments : allPayments.filter(p => p.status === activeTab)

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:4rem;"><div class="empty-state-icon">💳</div><div class="empty-state-title">Tidak ada pembayaran</div><div class="empty-state-text">${activeTab === 'pending' ? 'Tidak ada pembayaran yang menunggu verifikasi.' : 'Tidak ada data.'}</div></div>`
    return
  }

  container.innerHTML = `<div class="grid grid-3" style="gap:1.25rem;">
    ${filtered.map(p => {
      const booking = p.bookings
      const icons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }
      const icon = icons[booking?.fields?.type] || '🏟️'
      return `
        <div class="card" style="cursor:pointer;transition:all 0.2s;" onclick="window._openPaymentDetail('${p.id}')" onmouseover="this.style.borderColor='var(--clr-primary)'" onmouseout="this.style.borderColor='var(--clr-border)'">
          <div class="card-body">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
              ${getStatusBadge(p.status)}
              <span style="font-size:0.75rem;color:var(--clr-text-muted);">${formatDateShort(p.created_at)}</span>
            </div>

            <!-- Customer -->
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,var(--clr-primary),var(--clr-purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:0.875rem;flex-shrink:0;">
                ${booking?.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <div style="font-weight:600;font-size:0.875rem;">${booking?.profiles?.full_name || '-'}</div>
                <div style="font-size:0.75rem;color:var(--clr-text-muted);">${booking?.profiles?.phone || ''}</div>
              </div>
            </div>

            <!-- Field info -->
            <div style="background:var(--clr-surface-2);border-radius:8px;padding:0.75rem;font-size:0.8rem;margin-bottom:1rem;">
              <div style="font-weight:600;">${icon} ${booking?.fields?.name || '-'}</div>
              <div style="color:var(--clr-text-muted);margin-top:0.25rem;">📅 ${formatDateShort(booking?.booking_date)} &nbsp;🕐 ${formatTime(booking?.start_time)}–${formatTime(booking?.end_time)}</div>
            </div>

            <!-- Amount + Proof -->
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:1rem;font-weight:800;color:var(--clr-primary);">${formatCurrency(p.amount)}</span>
              ${p.payment_proof_url
                ? `<div style="width:48px;height:48px;border-radius:8px;overflow:hidden;background:var(--clr-surface-2);flex-shrink:0;">
                    <img src="${p.payment_proof_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='📷'" />
                  </div>`
                : '<span style="font-size:0.75rem;color:var(--clr-text-muted);">Belum upload</span>'
              }
            </div>

            ${p.status === 'pending' ? `
              <div style="display:flex;gap:0.5rem;margin-top:1rem;">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="event.stopPropagation();window._quickVerify('${p.id}')">✅ Verifikasi</button>
                <button class="btn btn-danger btn-sm" style="flex:1;" onclick="event.stopPropagation();window._openPaymentDetail('${p.id}')">✕ Tolak</button>
              </div>` : ''
            }
          </div>
        </div>
      `
    }).join('')}
  </div>`
}

// Global functions for onclick in dynamic HTML
window._openPaymentDetail = (id) => openPaymentDetail(id)
window._quickVerify = (id) => quickVerify(id)

async function quickVerify(id) {
  try {
    const payment = allPayments.find(p => p.id === id)
    if (!payment) return

    const { error } = await supabase
      .from('payments')
      .update({ status: 'verified', verified_by: profile.id, verified_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    // Update booking to confirmed
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', payment.booking_id)

    // Notify customer
    await sendNotification(
      payment.bookings.user_id,
      '✅ Pembayaran Terverifikasi!',
      `Pembayaran kamu untuk ${payment.bookings?.fields?.name} sebesar ${formatCurrency(payment.amount)} telah diverifikasi. Booking dikonfirmasi!`,
      'payment',
      payment.booking_id
    )

    showToast('Pembayaran berhasil diverifikasi! ✅', 'success')
    loadPayments()
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error')
  }
}

function openPaymentDetail(id) {
  selectedPayment = allPayments.find(p => p.id === id)
  if (!selectedPayment) return
  selectedPaymentId = id

  const booking = selectedPayment.bookings
  const icons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }
  const icon = icons[booking?.fields?.type] || '🏟️'

  // Fill proof image
  const imgContainer = document.getElementById('proofImageContainer')
  if (selectedPayment.payment_proof_url) {
    imgContainer.innerHTML = `<img src="${selectedPayment.payment_proof_url}" style="width:100%;height:100%;object-fit:contain;cursor:zoom-in;" onclick="window.open(this.src,'_blank')" />`
    document.getElementById('proofDownloadLink').href = selectedPayment.payment_proof_url
  } else {
    imgContainer.innerHTML = '<div style="text-align:center;color:var(--clr-text-muted);padding:2rem;"><div style="font-size:3rem;margin-bottom:1rem;">📷</div><div>Belum ada bukti pembayaran</div></div>'
  }

  // Fill booking info
  document.getElementById('paymentDetailInfo').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.6rem;font-size:0.875rem;">
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Pelanggan</span><strong>${booking?.profiles?.full_name || '-'}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">No. HP</span><span>${booking?.profiles?.phone || '-'}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Lapangan</span><strong>${icon} ${booking?.fields?.name || '-'}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Tanggal</span><span>${formatDateShort(booking?.booking_date)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Jam</span><span>${formatTime(booking?.start_time)}–${formatTime(booking?.end_time)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Durasi</span><span>${booking?.duration_hours} jam</span></div>
      <div style="height:1px;background:var(--clr-border);margin:0.25rem 0;"></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Metode</span><span>${selectedPayment.payment_method || '-'}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:1rem;"><span style="color:var(--clr-text-muted);">Total</span><strong style="color:var(--clr-primary);">${formatCurrency(selectedPayment.amount)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--clr-text-muted);">Status</span>${getStatusBadge(selectedPayment.status)}</div>
    </div>
  `

  // Show/hide action section
  const actionSection = document.getElementById('actionSection')
  if (selectedPayment.status === 'pending') {
    actionSection.style.display = 'block'
  } else {
    actionSection.style.display = 'none'
  }

  document.getElementById('rejectionSection').style.display = 'none'
  document.getElementById('paymentDetailModal').style.display = 'flex'
}

function setupDetailModal() {
  document.getElementById('closePaymentDetailModal').addEventListener('click', () => {
    document.getElementById('paymentDetailModal').style.display = 'none'
  })
  document.getElementById('paymentDetailModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('paymentDetailModal').style.display = 'none'
  })

  document.getElementById('verifyPaymentBtn').addEventListener('click', async () => {
    if (!selectedPaymentId) return
    const btn = document.getElementById('verifyPaymentBtn')
    setLoading(btn, true, 'Verifikasi')
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'verified', verified_by: profile.id, verified_at: new Date().toISOString() })
        .eq('id', selectedPaymentId)
      if (error) throw error
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', selectedPayment.booking_id)
      await sendNotification(
        selectedPayment.bookings.user_id,
        '✅ Pembayaran Terverifikasi!',
        `Pembayaran untuk ${selectedPayment.bookings?.fields?.name} sebesar ${formatCurrency(selectedPayment.amount)} telah diverifikasi. Booking dikonfirmasi!`,
        'payment', selectedPayment.booking_id
      )
      showToast('Pembayaran diverifikasi! ✅', 'success')
      document.getElementById('paymentDetailModal').style.display = 'none'
      loadPayments()
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error')
    } finally {
      setLoading(btn, false, 'Verifikasi Pembayaran')
    }
  })

  document.getElementById('rejectPaymentBtn').addEventListener('click', () => {
    document.getElementById('rejectionSection').style.display = 'block'
    document.getElementById('rejectPaymentBtn').style.display = 'none'
  })

  document.getElementById('cancelRejectBtn').addEventListener('click', () => {
    document.getElementById('rejectionSection').style.display = 'none'
    document.getElementById('rejectPaymentBtn').style.display = 'block'
  })

  document.getElementById('confirmRejectBtn').addEventListener('click', async () => {
    const reason = document.getElementById('rejectionReason').value.trim()
    if (!reason) { showToast('Tulis alasan penolakan', 'warning'); return }
    const btn = document.getElementById('confirmRejectBtn')
    setLoading(btn, true, 'Konfirmasi Tolak')
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'rejected', rejection_reason: reason, verified_by: profile.id, verified_at: new Date().toISOString() })
        .eq('id', selectedPaymentId)
      if (error) throw error
      await sendNotification(
        selectedPayment.bookings.user_id,
        '❌ Pembayaran Ditolak',
        `Pembayaran untuk ${selectedPayment.bookings?.fields?.name} ditolak. Alasan: ${reason}. Silakan upload ulang bukti.`,
        'payment', selectedPayment.booking_id
      )
      showToast('Pembayaran ditolak.', 'info')
      document.getElementById('paymentDetailModal').style.display = 'none'
      loadPayments()
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error')
    } finally {
      setLoading(btn, false, 'Konfirmasi Tolak')
    }
  })
}

init()
