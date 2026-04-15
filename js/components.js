import { getCurrentProfile, logout, getUnreadCount, markAllNotificationsRead } from './auth.js'
import { supabase } from './supabase.js'
import { formatDateTime } from './utils.js'

// ============================================================
// NAVBAR COMPONENT (for customer / public pages)
// ============================================================
export async function initNavbar(activePage = '') {
  const profile = await getCurrentProfile()
  const navbar = document.getElementById('navbar')
  if (!navbar) return profile

  const isAdmin = profile?.role === 'admin'
  let unreadCount = 0

  if (profile) {
    unreadCount = await getUnreadCount(profile.id)
  }

  const navLinks = `
    <a href="/index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      Beranda
    </a>
    ${profile ? `
      <a href="/my-bookings.html" class="nav-link ${activePage === 'bookings' ? 'active' : ''}">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
        Booking Saya
      </a>
    ` : ''}
  `

  const userActions = profile ? `
    <div class="nav-user">
      ${isAdmin ? `<a href="/admin/dashboard.html" class="btn btn-sm btn-outline">Admin Panel</a>` : ''}
      <div class="notification-wrapper">
        <button class="notification-btn" id="notifBtn">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
          ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
        </button>
        <div class="notification-dropdown" id="notifDropdown" style="display:none"></div>
      </div>
      <div class="user-dropdown">
        <button class="user-btn" id="userBtn">
          <div class="user-avatar">${profile.full_name?.charAt(0).toUpperCase() || 'U'}</div>
          <span class="user-name">${profile.full_name?.split(' ')[0] || 'User'}</span>
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7z"/></svg>
        </button>
        <div class="dropdown-menu" id="userDropdown" style="display:none">
          <div class="dropdown-header">
            <div class="dropdown-avatar">${profile.full_name?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <div class="dropdown-name">${profile.full_name}</div>
              <div class="dropdown-email text-muted">${profile.role === 'admin' ? '👑 Admin' : '👤 Customer'}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <a href="#" id="logoutBtn" class="dropdown-item text-danger">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            Keluar
          </a>
        </div>
      </div>
    </div>
  ` : `
    <div class="nav-auth">
      <a href="/login.html" class="btn btn-ghost">Masuk</a>
      <a href="/register.html" class="btn btn-primary">Daftar</a>
    </div>
  `

  navbar.innerHTML = `
    <div class="navbar-inner">
      <a href="/index.html" class="navbar-brand">
        <div class="brand-icon">⚽</div>
        <span>SportBook</span>
      </a>
      <button class="hamburger" id="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
      <div class="navbar-content" id="navbarContent">
        <nav class="navbar-links">${navLinks}</nav>
        ${userActions}
      </div>
    </div>
  `

  // Hamburger toggle
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('navbarContent')?.classList.toggle('open')
  })

  // User dropdown
  document.getElementById('userBtn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const dd = document.getElementById('userDropdown')
    const nd = document.getElementById('notifDropdown')
    nd && (nd.style.display = 'none')
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none'
  })

  // Notification dropdown
  document.getElementById('notifBtn')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    const nd = document.getElementById('notifDropdown')
    const dd = document.getElementById('userDropdown')
    dd && (dd.style.display = 'none')
    if (nd.style.display === 'none') {
      nd.style.display = 'block'
      await loadNotifications(nd, profile.id)
    } else {
      nd.style.display = 'none'
    }
  })

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.getElementById('userDropdown') && (document.getElementById('userDropdown').style.display = 'none')
    document.getElementById('notifDropdown') && (document.getElementById('notifDropdown').style.display = 'none')
  })

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault()
    await logout()
  })

  return profile
}

async function loadNotifications(container, userId) {
  container.innerHTML = '<div class="notif-loading">Memuat...</div>'
  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  await markAllNotificationsRead(userId)

  // Update badge
  const badge = document.querySelector('.notification-badge')
  if (badge) badge.remove()

  if (!notifs || notifs.length === 0) {
    container.innerHTML = '<div class="notif-empty">Tidak ada notifikasi</div>'
    return
  }

  const icons = { booking: '📋', payment: '💳', system: '🔔', general: 'ℹ️' }

  container.innerHTML = `
    <div class="notif-header">Notifikasi</div>
    <div class="notif-list">
      ${notifs.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
          <div class="notif-icon">${icons[n.type] || icons.general}</div>
          <div class="notif-content">
            <div class="notif-title">${n.title}</div>
            <div class="notif-message">${n.message}</div>
            <div class="notif-time">${formatDateTime(n.created_at)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

// ============================================================
// ADMIN SIDEBAR COMPONENT
// ============================================================
export function initAdminSidebar(activePage = '') {
  const sidebar = document.getElementById('adminSidebar')
  if (!sidebar) return

  const links = [
    { page: 'dashboard', icon: '📊', label: 'Dashboard', href: '/admin/dashboard.html' },
    { page: 'fields', icon: '🏟️', label: 'Lapangan', href: '/admin/fields.html' },
    { page: 'bookings', icon: '📋', label: 'Semua Booking', href: '/admin/bookings.html' },
    { page: 'payments', icon: '💳', label: 'Pembayaran', href: '/admin/payments.html' }
  ]

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">⚽</div>
      <div>
        <div class="brand-name">SportBook</div>
        <div class="brand-sub">Admin Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${links.map(l => `
        <a href="${l.href}" class="sidebar-link ${activePage === l.page ? 'active' : ''}">
          <span class="sidebar-icon">${l.icon}</span>
          <span>${l.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="/index.html" class="sidebar-link">
        <span class="sidebar-icon">🌐</span>
        <span>Lihat Situs</span>
      </a>
      <button class="sidebar-link sidebar-logout" id="sidebarLogout">
        <span class="sidebar-icon">🚪</span>
        <span>Keluar</span>
      </button>
    </div>
  `

  document.getElementById('sidebarLogout')?.addEventListener('click', async () => {
    await logout()
  })
}
