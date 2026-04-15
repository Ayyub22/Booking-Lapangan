import { supabase } from '../supabase.js'
import { initAdminSidebar } from '../components.js'
import { requireAdmin, sendNotification } from '../auth.js'
import { formatCurrency, formatDateShort, formatTime, getStatusBadge, exportToCSV, showToast, debounce } from '../utils.js'

let profile = null
let allBookings = []
let statusFilter = 'all'
let fieldFilter = 'all'
let selectedBookingId = null
let searchQuery = ''

async function init() {
  profile = await requireAdmin()
  if (!profile) return
  initAdminSidebar('bookings')
  await loadFields()
  await loadBookings()
  setupFilters()
  setupStatusModal()
  document.getElementById('exportBookingsBtn').addEventListener('click', exportData)
}

async function loadFields() {
  const { data } = await supabase.from('fields').select('id, name').order('name')
  const sel = document.getElementById('fieldFilter')
  ;(data || []).forEach(f => {
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = f.name
    sel.appendChild(opt)
  })
}

async function loadBookings() {
  const container = document.getElementById('bookingsTableContainer')
  container.innerHTML = '<div class="page-loading" style="min-height:200px;"><div class="spinner"></div></div>'
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, phone), fields(name, type), payments(status)')
      .order('created_at', { ascending: false })
    if (error) throw error
    allBookings = data || []
    updateCounts()
    renderTable()
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><div class="empty-state-icon">⚠️</div><div>${err.message}</div></div>`
  }
}

function updateCounts() {
  document.getElementById('countAll').textContent = allBookings.length
  document.getElementById('countPending').textContent = allBookings.filter(b => b.status === 'pending').length
  document.getElementById('countConfirmed').textContent = allBookings.filter(b => b.status === 'confirmed').length
  document.getElementById('countCompleted').textContent = allBookings.filter(b => b.status === 'completed').length
}

function renderTable() {
  const container = document.getElementById('bookingsTableContainer')
  const dateFrom = document.getElementById('dateFrom').value
  const dateTo = document.getElementById('dateTo').value

  let filtered = allBookings.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchField = fieldFilter === 'all' || b.field_id === fieldFilter
    const matchSearch = !searchQuery || b.profiles?.full_name?.toLowerCase().includes(searchQuery) || b.fields?.name?.toLowerCase().includes(searchQuery)
    const matchFrom = !dateFrom || b.booking_date >= dateFrom
    const matchTo = !dateTo || b.booking_date <= dateTo
    return matchStatus && matchField && matchSearch && matchFrom && matchTo
  })

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem;"><div class="empty-state-icon">📋</div><div class="empty-state-title">Tidak ada booking</div></div>'
    return
  }

  container.innerHTML = `
    <div class="table-wrapper" style="border:none;">
      <table class="table">
        <thead>
          <tr>
            <th>Pelanggan</th>
            <th>Lapangan</th>
            <th>Tanggal & Jam</th>
            <th>Durasi</th>
            <th>Total</th>
            <th>Bayar</th>
            <th>Status</th>
            <th style="text-align:right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(b => `<tr>
            <td>
              <div style="font-weight:600;font-size:0.875rem;">${b.profiles?.full_name || '-'}</div>
              <div style="font-size:0.75rem;color:var(--clr-text-muted);">${b.profiles?.phone || ''}</div>
            </td>
            <td style="font-size:0.875rem;">${b.fields?.name || '-'}</td>
            <td style="font-size:0.8rem;color:var(--clr-text-muted);">
              <div>${formatDateShort(b.booking_date)}</div>
              <div>${formatTime(b.start_time)} – ${formatTime(b.end_time)}</div>
            </td>
            <td style="font-size:0.875rem;">${b.duration_hours} jam</td>
            <td style="font-weight:700;color:var(--clr-primary);font-size:0.875rem;">${formatCurrency(b.total_price)}</td>
            <td>${b.payments?.length ? getStatusBadge(b.payments[0].status) : '<span class="badge badge-secondary">Belum</span>'}</td>
            <td>${getStatusBadge(b.status)}</td>
            <td>
              <button class="btn btn-ghost btn-sm update-status-btn" data-id="${b.id}" data-status="${b.status}" data-name="${b.profiles?.full_name || ''}" data-field="${b.fields?.name || ''}">
                ✏️ Update
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  container.querySelectorAll('.update-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBookingId = btn.dataset.id
      document.getElementById('newStatus').value = btn.dataset.status
      document.getElementById('statusBookingInfo').innerHTML = `
        <strong>${btn.dataset.name}</strong> — ${btn.dataset.field}<br>
        <span style="color:var(--clr-text-muted);">Status saat ini: ${getStatusBadge(btn.dataset.status)}</span>
      `
      document.getElementById('statusModal').style.display = 'flex'
    })
  })
}

function setupFilters() {
  const searchHandler = debounce((e) => { searchQuery = e.target.value.toLowerCase(); renderTable() }, 300)
  document.getElementById('searchBooking').addEventListener('input', searchHandler)
  document.getElementById('statusFilter').addEventListener('change', (e) => { statusFilter = e.target.value; renderTable() })
  document.getElementById('fieldFilter').addEventListener('change', (e) => { fieldFilter = e.target.value; renderTable() })
  document.getElementById('dateFrom').addEventListener('change', renderTable)
  document.getElementById('dateTo').addEventListener('change', renderTable)
}

function setupStatusModal() {
  document.getElementById('closeStatusModal').addEventListener('click', () => { document.getElementById('statusModal').style.display = 'none' })
  document.getElementById('cancelStatusBtn').addEventListener('click', () => { document.getElementById('statusModal').style.display = 'none' })
  document.getElementById('statusModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('statusModal').style.display = 'none' })

  document.getElementById('saveStatusBtn').addEventListener('click', async () => {
    if (!selectedBookingId) return
    const newStatus = document.getElementById('newStatus').value
    const btn = document.getElementById('saveStatusBtn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'

    try {
      const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', selectedBookingId)
      if (error) throw error

      // Get booking to notify user
      const booking = allBookings.find(b => b.id === selectedBookingId)
      if (booking) {
        const statusLabels = { confirmed: 'dikonfirmasi', cancelled: 'dibatalkan', completed: 'selesai', pending: 'menunggu' }
        await sendNotification(
          booking.user_id,
          '📋 Status Booking Diperbarui',
          `Booking ${booking.fields?.name} kamu telah ${statusLabels[newStatus]}. Total: ${formatCurrency(booking.total_price)}.`,
          'booking',
          selectedBookingId
        )
      }

      showToast('Status berhasil diperbarui!', 'success')
      document.getElementById('statusModal').style.display = 'none'
      loadBookings()
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan Status'
    }
  })
}

async function exportData() {
  const csv = allBookings.map(b => ({
    ID: b.id,
    Pelanggan: b.profiles?.full_name || '',
    No_HP: b.profiles?.phone || '',
    Lapangan: b.fields?.name || '',
    Tanggal: b.booking_date,
    Jam_Mulai: b.start_time,
    Jam_Selesai: b.end_time,
    Durasi: b.duration_hours,
    Total: b.total_price,
    Status_Booking: b.status,
    Status_Bayar: b.payments?.[0]?.status || 'belum',
    Dibuat: b.created_at
  }))
  exportToCSV(csv, `bookings_${new Date().toISOString().split('T')[0]}.csv`)
}

init()
