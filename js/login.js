import { login, getCurrentUser } from './auth.js'
import { showToast, setLoading } from './utils.js'

async function init() {
  // Redirect if already logged in
  const user = await getCurrentUser()
  if (user) {
    window.location.href = '/index.html'
    return
  }

  const form = document.getElementById('loginForm')
  const btn = document.getElementById('loginBtn')
  const errEl = document.getElementById('loginError')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errEl.style.display = 'none'

    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value

    setLoading(btn, true, 'Masuk')
    try {
      await login(email, password)
      showToast('Login berhasil! Mengalihkan...', 'success')
      // Small delay to show toast
      await new Promise(r => setTimeout(r, 800))
      window.location.href = '/index.html'
    } catch (err) {
      let msg = 'Email atau password salah. Coba lagi.'
      if (err.message?.includes('Invalid login')) msg = 'Email atau password tidak valid.'
      else if (err.message?.includes('Email not confirmed')) msg = 'Email belum dikonfirmasi. Cek inbox kamu.'
      errEl.textContent = msg
      errEl.style.display = 'block'
    } finally {
      setLoading(btn, false, 'Masuk')
    }
  })
}

init()
