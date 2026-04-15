import { supabase } from './supabase.js'
import { showToast } from './utils.js'

// --- Get current session user ---
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user || null
}

// --- Get current user's profile from DB ---
export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

// --- Require any logged-in user (redirect if not) ---
export async function requireAuth(redirectTo = '/login.html') {
  const user = await getCurrentUser()
  if (!user) {
    window.location.href = redirectTo
    return null
  }
  return user
}

// --- Require admin role ---
export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    showToast('Akses ditolak. Halaman ini hanya untuk Admin.', 'error')
    setTimeout(() => { window.location.href = '/index.html' }, 1500)
    return null
  }
  return profile
}

// --- Require customer role ---
export async function requireCustomer() {
  const profile = await getCurrentProfile()
  if (!profile) {
    window.location.href = '/login.html'
    return null
  }
  return profile
}

// --- Logout ---
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

// --- Register new user ---
export async function register(email, password, fullName, phone) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: phone }
    }
  })

  if (error) throw error
  return data
}

// --- Login ---
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// --- Get unread notification count ---
export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return count || 0
}

// --- Mark all notifications as read ---
export async function markAllNotificationsRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
}

// --- Send notification to user ---
export async function sendNotification(userId, title, message, type = 'general', referenceId = null) {
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId
  })
}
