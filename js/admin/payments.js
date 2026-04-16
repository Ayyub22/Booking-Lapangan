import { supabase } from '../supabase.js'
import { initAdminSidebar } from '../components.js'
import { requireAdmin } from '../auth.js'
import { formatCurrency, formatDateShort, formatTime, getStatusBadge } from '../utils.js'

let profile = null
let allPayments = []

async function init() {
  profile = await requireAdmin()
  if (!profile) return
  initAdminSidebar('payments')
  await loadPayments()
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

function renderPayments() {
  const container = document.getElementById('paymentsContainer')
  
  if (allPayments.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:4rem;"><div class="empty-state-icon">💳</div><div class="empty-state-title">Tidak ada pembayaran</div><div class="empty-state-text">Belum ada transaksi pembayaran yang berhasil masuk.</div></div>`
    return
  }

  container.innerHTML = `<div class="grid grid-3" style="gap:1.25rem;">
    ${allPayments.map(p => {
      const booking = p.bookings
      const icons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }
      const icon = icons[booking?.fields?.type] || '🏟️'
      
      return `
        <div class="card" style="transition:all 0.2s;" onmouseover="this.style.borderColor='var(--clr-primary)'" onmouseout="this.style.borderColor='var(--clr-border)'">
          <div class="card-body">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
              <span class="badge badge-success">Midtrans Sukses</span>
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

            <!-- Amount + Payment Method -->
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--clr-border);padding-top:0.75rem;">
              <div style="display:flex;flex-direction:column;">
                <span style="font-size:0.75rem;color:var(--clr-text-muted);">Metode Pembayaran</span>
                <strong style="font-size:0.875rem;">${p.payment_method || 'Online'}</strong>
              </div>
              <span style="font-size:1.1rem;font-weight:800;color:var(--clr-primary);">${formatCurrency(p.amount)}</span>
            </div>

          </div>
        </div>
      `
    }).join('')}
  </div>`
}

init()
