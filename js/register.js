import { register, getCurrentUser } from './auth.js'
import { showToast, setLoading } from './utils.js'

async function init() {
  const user = await getCurrentUser()
  if (user) {
    window.location.href = '/index.html'
    return
  }

  const form = document.getElementById('registerForm')
  const btn = document.getElementById('registerBtn')
  const errEl = document.getElementById('registerError')
  const successEl = document.getElementById('registerSuccess')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errEl.style.display = 'none'
    successEl.style.display = 'none'

    const fullName = document.getElementById('fullName').value.trim()
    const phone = document.getElementById('phone').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const confirmPw = document.getElementById('confirmPassword').value

    // Validation
    if (fullName.length < 3) {
      errEl.textContent = 'Nama lengkap minimal 3 karakter.'
      errEl.style.display = 'block'
      return
    }
    if (password !== confirmPw) {
      errEl.textContent = 'Password dan konfirmasi password tidak cocok.'
      errEl.style.display = 'block'
      return
    }
    if (password.length < 6) {
      errEl.textContent = 'Password minimal 6 karakter.'
      errEl.style.display = 'block'
      return
    }

    setLoading(btn, true, 'Daftar Sekarang')
    try {
      const { user } = await register(email, password, fullName, phone)
      if (user && user.identities?.length === 0) {
        errEl.textContent = 'Email ini sudah terdaftar. Silakan masuk.'
        errEl.style.display = 'block'
        return
      }
      successEl.innerHTML = `
        ✅ <strong>Pendaftaran berhasil!</strong><br>
        Silakan cek email <strong>${email}</strong> untuk konfirmasi akun, lalu <a href="/login.html" style="color:var(--clr-primary);font-weight:600;">masuk di sini</a>.
      `
      successEl.style.display = 'block'
      form.reset()
      showToast('Akun berhasil dibuat!', 'success')
    } catch (err) {
      let msg = 'Terjadi kesalahan. Coba lagi.'
      if (err.message?.includes('already registered')) msg = 'Email ini sudah terdaftar.'
      else if (err.message?.includes('password')) msg = 'Password terlalu lemah. Gunakan kombinasi yang lebih kuat.'
      else if (err.message) msg = err.message
      errEl.textContent = msg
      errEl.style.display = 'block'
    } finally {
      setLoading(btn, false, 'Daftar Sekarang')
    }
  })
}

init()
