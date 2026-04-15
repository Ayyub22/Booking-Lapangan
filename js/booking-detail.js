import { supabase } from './supabase.js'
import { initNavbar } from './components.js'
import { requireCustomer, sendNotification } from './auth.js'
import { getParam, formatCurrency, formatDate, formatTime, getStatusBadge, showToast, setLoading } from './utils.js'

const bookingId = getParam('id')
document.getElementById('year').textContent = new Date().getFullYear()

let profile = null
let booking = null

async function init() {
  profile = await requireCustomer()
  if (!profile) return
  await initNavbar('bookings')
  if (!bookingId) { window.location.href = '/my-bookings.html'; return }
  await loadBookingDetail()
}

async function loadBookingDetail() {
  const container = document.getElementById('detailContent')
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, fields(*), payments(*)')
      .eq('id', bookingId)
      .eq('user_id', profile.id)
      .single()

    if (error || !data) throw new Error('Booking tidak ditemukan.')
    booking = data
    renderDetail()
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="min-height:60vh;justify-content:center;display:flex;flex-direction:column;align-items:center;">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Booking Tidak Ditemukan</div>
      <div class="empty-state-text">${err.message}</div>
      <a href="/my-bookings.html" class="btn btn-primary" style="margin-top:1.5rem;">← Kembali</a>
    </div>`
  }
}

function renderDetail() {
  const f = booking.fields
  const payment = booking.payments?.[0]
  const icons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }
  const icon = icons[f?.type] || '🏟️'
  const isPaid = payment && payment.status === 'verified'
  const showPayBtn = booking.status === 'pending' && !isPaid

  const timeline = [
    { key: 'pending', label: 'Booking Dibuat', done: true, desc: 'Menunggu konfirmasi admin' },
    { key: 'payment', label: 'Pembayaran', done: !!payment, desc: payment ? (payment.status === 'verified' ? 'Terverifikasi' : 'Menunggu verifikasi') : 'Belum melakukan pembayaran' },
    { key: 'confirmed', label: 'Booking Dikonfirmasi', done: booking.status === 'confirmed' || booking.status === 'completed', desc: 'Sistem telah memverifikasi pembayaran' },
    { key: 'completed', label: 'Selesai', done: booking.status === 'completed', desc: 'Bermain sudah selesai' },
  ]

  document.getElementById('detailContent').innerHTML = `
    <div class="page-header">
      <h1 class="page-header-title">📋 Detail Booking</h1>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:2rem;align-items:start;">
      <!-- Left -->
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <!-- Booking Info -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏟️ Info Lapangan</span>
            ${getStatusBadge(booking.status)}
          </div>
          <div class="card-body">
            <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.25rem;">
              <div style="width:72px;height:72px;border-radius:10px;overflow:hidden;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0;">
                ${f?.image_url ? `<img src="${f.image_url}" style="width:100%;height:100%;object-fit:cover;" />` : icon}
              </div>
              <div>
                <div style="font-size:1.1rem;font-weight:700;">${f?.name || '-'}</div>
                <div style="color:var(--clr-text-muted);font-size:0.875rem;">${f?.type ? f.type.charAt(0).toUpperCase() + f.type.slice(1) : '-'}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.875rem;">
              <div style="background:var(--clr-surface-2);padding:0.75rem;border-radius:8px;">
                <div style="color:var(--clr-text-muted);font-size:0.75rem;margin-bottom:0.25rem;">Tanggal</div>
                <div style="font-weight:600;">📅 ${formatDate(booking.booking_date)}</div>
              </div>
              <div style="background:var(--clr-surface-2);padding:0.75rem;border-radius:8px;">
                <div style="color:var(--clr-text-muted);font-size:0.75rem;margin-bottom:0.25rem;">Jam</div>
                <div style="font-weight:600;">🕐 ${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}</div>
              </div>
              <div style="background:var(--clr-surface-2);padding:0.75rem;border-radius:8px;">
                <div style="color:var(--clr-text-muted);font-size:0.75rem;margin-bottom:0.25rem;">Durasi</div>
                <div style="font-weight:600;">⏱️ ${booking.duration_hours} Jam</div>
              </div>
              <div style="background:var(--clr-surface-2);padding:0.75rem;border-radius:8px;">
                <div style="color:var(--clr-text-muted);font-size:0.75rem;margin-bottom:0.25rem;">Harga per Jam</div>
                <div style="font-weight:600;">💰 ${formatCurrency(f?.price_per_hour || 0)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Status -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">💳 Pembayaran Midtrans</span>
            ${payment ? getStatusBadge(payment.status) : `<span class="badge badge-warning">Belum Bayar</span>`}
          </div>
          <div class="card-body">
            ${isPaid ? `
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);padding:1rem;border-radius:8px;display:flex;align-items:center;gap:0.75rem;">
                 <div style="color:var(--clr-success);font-size:1.5rem;">✅</div>
                 <div>
                    <div style="font-weight:600;font-size:0.875rem;">Pembayaran Sukses</div>
                    <div style="font-size:0.75rem;color:var(--clr-text-muted);">Transaksi telah diproses via Midtrans (${payment.payment_method || 'Online'})</div>
                 </div>
              </div>
            ` : `
              <p style="color:var(--clr-text-muted);font-size:0.875rem;margin-bottom:1rem;">Ketuk tombol di bawah untuk membayar dengan banyak pilihan metode (Gopay, QRIS, Virtual Account, dll).</p>
              ${booking.status !== 'cancelled'
                ? `<button class="btn btn-primary" id="openPaymentBtn">💳 Bayar Sekarang via Midtrans</button>`
                : `<div style="color:var(--clr-danger);font-size:0.875rem;">Booking telah dibatalkan.</div>`
              }
            `}
          </div>
        </div>
      </div>

      <!-- Right: Summary + Timeline -->
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <!-- Price Summary -->
        <div class="card" style="border:1px solid rgba(16,185,129,0.2);">
          <div class="card-header"><span class="card-title">💰 Ringkasan</span></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:0.875rem;">
              <span style="color:var(--clr-text-muted);">${formatCurrency(f?.price_per_hour)} × ${booking.duration_hours} jam</span>
              <span>${formatCurrency(booking.total_price)}</span>
            </div>
            <div class="divider"></div>
            <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;">
              <span>Total</span>
              <span style="color:var(--clr-primary);">${formatCurrency(booking.total_price)}</span>
            </div>
          </div>
        </div>

        <!-- Status Timeline -->
        <div class="card">
          <div class="card-header"><span class="card-title">📍 Status Booking</span></div>
          <div class="card-body">
            <div class="timeline">
              ${timeline.map((t, i) => `
                <div class="timeline-item ${t.done ? 'done' : i === timeline.findIndex(x => !x.done) ? 'active' : ''}">
                  <div class="timeline-dot"></div>
                  <div class="timeline-title">${t.label}</div>
                  <div class="timeline-desc">${t.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  // Attach listener
  const btn = document.getElementById('openPaymentBtn')
  if (btn) btn.addEventListener('click', processPayment)
}

// ============================================================
// MIDTRANS PAYMENT FLOW
// ============================================================
async function processPayment() {
  const btn = document.getElementById('openPaymentBtn')
  setLoading(btn, true, 'Memproses...')

  try {
    // 1. Dapatkan Token dari Vercel Serverless Function
    const res = await fetch('/api/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: booking.id,
        amount: booking.total_price,
        customerName: profile.full_name,
        customerEmail: profile.email || 'customer@example.com',
        customerPhone: profile.phone || '',
        fieldName: booking.fields?.name || 'Sewa Lapangan'
      })
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Server error saat generate token Midtrans')
    if (!data.token) throw new Error('Token Midtrans tidak terambil!')

    // 2. Tampilkan Popup Midtrans (Snap UI)
    window.snap.pay(data.token, {
      onSuccess: async function (result) {
        // Pembayaran Berhasil!
        await saveVerifiedPayment(result)
      },
      onPending: function (result) {
        // User menutup popup sebelum selesai, atau pilih transfer manual dll
        showToast('Menunggu pembayaran diselesaikan...', 'info')
      },
      onError: function (result) {
         showToast('Pembayaran Gagal diproses oleh sistem.', 'error')
      },
      onClose: function () {
         showToast('Kamu menutup jendela pembayaran', 'warning')
      }
    })
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setLoading(btn, false, '💳 Bayar Sekarang via Midtrans')
  }
}

async function saveVerifiedPayment(midtransResult) {
   // Buat data pembayaran masuk ke supabase sbg verified
   const method = midtransResult.payment_type || 'midtrans'
   
   try {
     // A. Insert ke tabel pembayaran dengan status verified
     const { error: payErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        amount: booking.total_price,
        payment_method: method.replace(/_/g, ' ').toUpperCase(),
        status: 'verified' // Langsung tandai terverifikasi karena dari Snap success
     })
     if (payErr) throw payErr

     // B. Ubah status booking menjadi confirmed
     const { error: bookErr } = await supabase.from('bookings').update({
        status: 'confirmed'
     }).eq('id', bookingId)
     if (bookErr) throw bookErr

     await sendNotification(profile.id, '✅ Pembayaran Berhasil', 'Pembayaran Midtrans sukses, booking-mu telah otomatis dikonfirmasi.', 'payment', bookingId)

     showToast('Pembayaran Sukses! Selamat Bermain!', 'success')
     await loadBookingDetail() // reload UI
   } catch(e) {
     console.error(e)
     showToast('Gagal mencatat status pembayaran ke database', 'error')
   }
}

init()
