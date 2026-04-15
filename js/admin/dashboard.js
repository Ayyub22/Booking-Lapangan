import { supabase } from '../supabase.js'
import { initAdminSidebar } from '../components.js'
import { requireAdmin, sendNotification } from '../auth.js'
import { formatCurrency, formatDateShort, formatTime, getStatusBadge, exportToCSV, showToast } from '../utils.js'

let profile = null

async function init() {
  profile = await requireAdmin()
  if (!profile) return
  initAdminSidebar('dashboard')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam'
  document.getElementById('dashGreeting').textContent = `${greeting}, ${profile.full_name}! 👋`

  await Promise.all([loadStats(), loadCharts(), loadRecentBookings(), loadTopFields()])

  document.getElementById('periodFilter').addEventListener('change', async () => {
    await Promise.all([loadCharts(), loadStats()])
  })
  document.getElementById('exportBtn').addEventListener('click', exportBookings)
}

async function loadStats() {
  try {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [
      { count: totalBookings },
      { count: pendingCount },
      { count: activeFields },
      { data: thisMonthRevenue }
    ] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('fields').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('bookings').select('total_price').gte('created_at', thisMonthStart).eq('status', 'confirmed')
    ])

    const revenue = (thisMonthRevenue || []).reduce((s, b) => s + (b.total_price || 0), 0)

    document.getElementById('statTotalBookings').textContent = totalBookings ?? 0
    document.getElementById('statPending').textContent = pendingCount ?? 0
    document.getElementById('statFields').textContent = activeFields ?? 0
    document.getElementById('statRevenue').textContent = formatCurrency(revenue)
    document.getElementById('statRevenue').style.fontSize = '1.25rem'
    document.getElementById('statBookingChange').textContent = `${totalBookings} total booking`
    document.getElementById('statRevenueChange').textContent = `Bulan ${now.toLocaleString('id-ID', { month: 'long' })}`
  } catch (err) {
    console.error('Error loading stats:', err)
  }
}

async function loadCharts() {
  const days = parseInt(document.getElementById('periodFilter').value)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_date, total_price, status, fields(type)')
    .gte('created_at', startDate.toISOString())
    .order('booking_date')

  renderBookingChart(bookings || [], days)
  renderFieldTypeChart(bookings || [])
  renderRevenueChart()
}

function renderBookingChart(bookings, days) {
  const labels = []
  const counts = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    labels.push(d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }))
    counts.push(bookings.filter(b => b.booking_date === key).length)
  }

  const ctx = document.getElementById('bookingChart')
  if (ctx._chart) ctx._chart.destroy()
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Booking',
        data: counts,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', stepSize: 1 } }
      }
    }
  })
}

function renderFieldTypeChart(bookings) {
  const counts = {}
  bookings.forEach(b => {
    const type = b.fields?.type || 'lainnya'
    counts[type] = (counts[type] || 0) + 1
  })
  const labels = Object.keys(counts)
  const data = Object.values(counts)
  const colors = { futsal:'#10b981', basket:'#f59e0b', badminton:'#3b82f6', tenis:'#8b5cf6', voli:'#ef4444', renang:'#06b6d4', lainnya:'#6b7280' }

  const ctx = document.getElementById('fieldTypeChart')
  if (ctx._chart) ctx._chart.destroy()
  ctx._chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{ data, backgroundColor: labels.map(l => colors[l] || '#6b7280'), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12, font: { size: 11 } } }
      },
      cutout: '65%'
    }
  })
}

async function renderRevenueChart() {
  const months = []
  const revenues = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString().split('T')[0]
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    months.push(d.toLocaleDateString('id-ID', { month: 'short' }))

    const { data } = await supabase
      .from('bookings').select('total_price')
      .gte('booking_date', start).lte('booking_date', end).eq('status', 'confirmed')
    revenues.push((data || []).reduce((s, b) => s + (b.total_price || 0), 0))
  }

  const ctx = document.getElementById('revenueChart')
  if (ctx._chart) ctx._chart.destroy()
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Pendapatan (Rp)',
        data: revenues,
        backgroundColor: 'rgba(16,185,129,0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af', callback: val => 'Rp' + (val / 1000).toFixed(0) + 'K' }
        }
      }
    }
  })
}

async function loadRecentBookings() {
  const { data } = await supabase
    .from('bookings')
    .select('*, profiles(full_name), fields(name, type)')
    .order('created_at', { ascending: false })
    .limit(8)

  const container = document.getElementById('recentBookings')
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;"><div class="empty-state-icon">📋</div><div>Belum ada booking</div></div>'
    return
  }

  container.innerHTML = `<div class="table-wrapper" style="border:none;">
    <table class="table">
      <thead><tr><th>Pelanggan</th><th>Lapangan</th><th>Tanggal</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${data.map(b => `<tr>
          <td style="font-weight:500;">${b.profiles?.full_name || '-'}</td>
          <td>${b.fields?.name || '-'}</td>
          <td style="color:var(--clr-text-muted);font-size:0.8rem;">${formatDateShort(b.booking_date)}</td>
          <td style="color:var(--clr-primary);font-weight:600;">${formatCurrency(b.total_price)}</td>
          <td>${getStatusBadge(b.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

async function loadTopFields() {
  const { data } = await supabase
    .from('bookings')
    .select('field_id, fields(name, type), total_price')
    .eq('status', 'confirmed')

  const fieldMap = {}
  ;(data || []).forEach(b => {
    const id = b.field_id
    if (!fieldMap[id]) fieldMap[id] = { name: b.fields?.name, type: b.fields?.type, count: 0, revenue: 0 }
    fieldMap[id].count++
    fieldMap[id].revenue += b.total_price || 0
  })

  const sorted = Object.values(fieldMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const typeIcons = { futsal:'⚽', basket:'🏀', badminton:'🏸', tenis:'🎾', voli:'🏐', renang:'🏊', lainnya:'🏟️' }

  const container = document.getElementById('topFields')
  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;"><div class="empty-state-icon">🏟️</div><div>Belum ada data</div></div>'
    return
  }

  container.innerHTML = sorted.map((f, i) => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--clr-border);${i === sorted.length - 1 ? 'border:none;' : ''}">
      <div style="width:28px;height:28px;background:${i === 0 ? 'var(--clr-accent)' : 'var(--clr-surface-2)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:${i === 0 ? '#0a0f1e' : 'var(--clr-text-muted)'};">${i + 1}</div>
      <div style="font-size:1.1rem;">${typeIcons[f.type] || '🏟️'}</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:0.875rem;">${f.name}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-muted);">${f.count} booking</div>
      </div>
      <div style="font-weight:700;font-size:0.875rem;color:var(--clr-primary);">${formatCurrency(f.revenue)}</div>
    </div>
  `).join('')
}

async function exportBookings() {
  const { data } = await supabase
    .from('bookings')
    .select('*, profiles(full_name, phone), fields(name, type)')
    .order('created_at', { ascending: false })

  const csv = (data || []).map(b => ({
    ID: b.id,
    Pelanggan: b.profiles?.full_name || '',
    No_HP: b.profiles?.phone || '',
    Lapangan: b.fields?.name || '',
    Jenis: b.fields?.type || '',
    Tanggal: b.booking_date,
    Jam_Mulai: b.start_time,
    Jam_Selesai: b.end_time,
    Durasi_Jam: b.duration_hours,
    Total_Harga: b.total_price,
    Status: b.status,
    Dibuat: b.created_at
  }))
  exportToCSV(csv, `booking_report_${new Date().toISOString().split('T')[0]}.csv`)
}

init()
