import { supabase } from '../supabase.js'
import { initAdminSidebar } from '../components.js'
import { requireAdmin } from '../auth.js'
import { formatCurrency, formatTime, getSportConfig, showToast, setLoading, debounce } from '../utils.js'

let profile = null
let allFields = []
let selectedFileNew = null
let fieldToDelete = null
let activeTypeFilter = 'all'
let statusFilter = 'all'
let editingFieldId = null

async function init() {
  profile = await requireAdmin()
  if (!profile) return
  initAdminSidebar('fields')
  await loadFields()
  setupModals()
  setupFilters()
}

async function loadFields() {
  const container = document.getElementById('fieldsTableContainer')
  container.innerHTML = '<div class="page-loading" style="min-height:200px;"><div class="spinner"></div></div>'
  try {
    const { data, error } = await supabase
      .from('fields')
      .select('*, bookings(id)')
      .order('name')
    if (error) throw error
    allFields = data || []
    renderTable()
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><div class="empty-state-icon">⚠️</div><div>${err.message}</div></div>`
  }
}

function renderTable() {
  const container = document.getElementById('fieldsTableContainer')
  let filtered = allFields.filter(f => {
    const matchType = activeTypeFilter === 'all' || f.type === activeTypeFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? f.is_active : !f.is_active)
    const q = document.getElementById('searchField').value.toLowerCase()
    const matchSearch = !q || f.name.toLowerCase().includes(q)
    return matchType && matchStatus && matchSearch
  })

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem;"><div class="empty-state-icon">🏟️</div><div class="empty-state-title">Tidak ada lapangan</div><div class="empty-state-text">Coba ubah filter atau tambah lapangan baru.</div></div>'
    return
  }

  container.innerHTML = `
    <div class="table-wrapper" style="border:none;">
      <table class="table">
        <thead>
          <tr>
            <th>Lapangan</th>
            <th>Jenis</th>
            <th>Harga/Jam</th>
            <th>Jam Operasional</th>
            <th>Total Booking</th>
            <th>Status</th>
            <th style="text-align:right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(f => {
            const cfg = getSportConfig(f.type)
            return `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                  <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.25rem;">
                    ${f.image_url ? `<img src="${f.image_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${cfg.icon}'" />` : cfg.icon}
                  </div>
                  <div style="font-weight:600;">${f.name}</div>
                </div>
              </td>
              <td><span class="badge badge-${f.type}">${cfg.icon} ${cfg.label}</span></td>
              <td style="font-weight:600;color:var(--clr-primary);">${formatCurrency(f.price_per_hour)}</td>
              <td style="font-size:0.8rem;color:var(--clr-text-muted);">${formatTime(f.open_time)} – ${formatTime(f.close_time)}</td>
              <td style="text-align:center;">${f.bookings?.length || 0}</td>
              <td>
                <span class="badge ${f.is_active ? 'badge-success' : 'badge-secondary'}">
                  ${f.is_active ? '✅ Aktif' : '⏸ Nonaktif'}
                </span>
              </td>
              <td>
                <div class="table-actions" style="justify-content:flex-end;">
                  <button class="btn btn-ghost btn-icon edit-btn" data-id="${f.id}" title="Edit">✏️</button>
                  <button class="btn btn-ghost btn-icon toggle-btn" data-id="${f.id}" data-active="${f.is_active}" title="${f.is_active ? 'Nonaktifkan' : 'Aktifkan'}">${f.is_active ? '⏸' : '▶️'}</button>
                  <button class="btn btn-ghost btn-icon delete-btn" data-id="${f.id}" data-name="${f.name}" title="Hapus" style="color:var(--clr-danger);">🗑️</button>
                </div>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  `

  // Attach listeners
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  })
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fieldToDelete = btn.dataset.id
      document.getElementById('deleteFieldName').textContent = btn.dataset.name
      document.getElementById('deleteModal').style.display = 'flex'
    })
  })
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleFieldStatus(btn.dataset.id, btn.dataset.active === 'true'))
  })
}

async function toggleFieldStatus(id, currentActive) {
  try {
    const { error } = await supabase.from('fields').update({ is_active: !currentActive }).eq('id', id)
    if (error) throw error
    showToast(`Lapangan ${currentActive ? 'dinonaktifkan' : 'diaktifkan'}`, 'success')
    loadFields()
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error')
  }
}

function setupFilters() {
  const searchHandler = debounce(() => renderTable(), 300)
  document.getElementById('searchField').addEventListener('input', searchHandler)
  document.getElementById('statusFilter').addEventListener('change', (e) => { statusFilter = e.target.value; renderTable() })
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      activeTypeFilter = chip.dataset.type
      renderTable()
    })
  })
}

function openAddModal() {
  editingFieldId = null
  selectedFileNew = null
  document.getElementById('fieldModalTitle').textContent = '➕ Tambah Lapangan'
  document.getElementById('fieldForm').reset()
  document.getElementById('fieldId').value = ''
  document.getElementById('imagePreviewContainer').style.display = 'none'
  document.getElementById('currentImageContainer').style.display = 'none'
  document.getElementById('fieldIsActive').checked = true
  document.getElementById('fieldFormError').style.display = 'none'
  document.getElementById('fieldModal').style.display = 'flex'
}

async function openEditModal(id) {
  const f = allFields.find(x => x.id === id)
  if (!f) return
  editingFieldId = id
  selectedFileNew = null

  document.getElementById('fieldModalTitle').textContent = '✏️ Edit Lapangan'
  document.getElementById('fieldId').value = f.id
  document.getElementById('fieldName').value = f.name
  document.getElementById('fieldType').value = f.type
  document.getElementById('fieldPrice').value = f.price_per_hour
  document.getElementById('pricePreview').textContent = `≈ ${formatCurrency(f.price_per_hour)} / jam`
  document.getElementById('fieldOpenTime').value = f.open_time?.slice(0, 5) || '07:00'
  document.getElementById('fieldCloseTime').value = f.close_time?.slice(0, 5) || '22:00'
  document.getElementById('fieldDescription').value = f.description || ''
  document.getElementById('fieldIsActive').checked = f.is_active
  document.getElementById('imagePreviewContainer').style.display = 'none'

  if (f.image_url) {
    document.getElementById('currentImage').src = f.image_url
    document.getElementById('currentImageContainer').style.display = 'block'
  } else {
    document.getElementById('currentImageContainer').style.display = 'none'
  }

  document.getElementById('fieldFormError').style.display = 'none'
  document.getElementById('fieldModal').style.display = 'flex'
}

function setupModals() {
  document.getElementById('addFieldBtn').addEventListener('click', openAddModal)

  const closeModal = () => { document.getElementById('fieldModal').style.display = 'none'; selectedFileNew = null }
  document.getElementById('closeFieldModal').addEventListener('click', closeModal)
  document.getElementById('cancelFieldBtn').addEventListener('click', closeModal)

  // Image preview
  document.getElementById('fieldImage').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('Ukuran file maks 5MB', 'error'); return }
    selectedFileNew = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      document.getElementById('imagePreview').src = ev.target.result
      document.getElementById('imagePreviewContainer').style.display = 'block'
      document.getElementById('currentImageContainer').style.display = 'none'
    }
    reader.readAsDataURL(file)
  })

  document.getElementById('removeImageBtn').addEventListener('click', () => {
    selectedFileNew = null
    document.getElementById('fieldImage').value = ''
    document.getElementById('imagePreviewContainer').style.display = 'none'
  })

  // Price preview
  document.getElementById('fieldPrice').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value)
    document.getElementById('pricePreview').textContent = val ? `≈ ${formatCurrency(val)} / jam` : ''
  })

  document.getElementById('saveFieldBtn').addEventListener('click', saveField)

  // Delete modal
  document.getElementById('closeDeleteModal').addEventListener('click', () => { document.getElementById('deleteModal').style.display = 'none' })
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => { document.getElementById('deleteModal').style.display = 'none' })
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteField)

  // Close on overlay click
  document.getElementById('fieldModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal() })
  document.getElementById('deleteModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('deleteModal').style.display = 'none' })
}

async function saveField() {
  const btn = document.getElementById('saveFieldBtn')
  const errEl = document.getElementById('fieldFormError')
  errEl.style.display = 'none'

  const name = document.getElementById('fieldName').value.trim()
  const type = document.getElementById('fieldType').value
  const price = parseFloat(document.getElementById('fieldPrice').value)
  const openTime = document.getElementById('fieldOpenTime').value
  const closeTime = document.getElementById('fieldCloseTime').value
  const description = document.getElementById('fieldDescription').value.trim()
  const isActive = document.getElementById('fieldIsActive').checked

  if (!name || !type || !price || !openTime || !closeTime) {
    errEl.textContent = 'Lengkapi semua field wajib.'
    errEl.style.display = 'block'
    return
  }
  if (openTime >= closeTime) {
    errEl.textContent = 'Jam tutup harus lebih besar dari jam buka.'
    errEl.style.display = 'block'
    return
  }

  setLoading(btn, true, 'Simpan Lapangan')
  try {
    let imageUrl = null

    if (selectedFileNew) {
      const ext = selectedFileNew.name.split('.').pop()
      const path = `field_${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('field-images').upload(path, selectedFileNew, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('field-images').getPublicUrl(path)
      imageUrl = publicUrl
    }

    const payload = { name, type, price_per_hour: price, open_time: openTime, close_time: closeTime, description: description || null, is_active: isActive }
    if (imageUrl) payload.image_url = imageUrl

    let error
    if (editingFieldId) {
      ;({ error } = await supabase.from('fields').update(payload).eq('id', editingFieldId))
    } else {
      ;({ error } = await supabase.from('fields').insert(payload))
    }

    if (error) throw error
    showToast(`Lapangan berhasil ${editingFieldId ? 'diperbarui' : 'ditambahkan'}! 🏟️`, 'success')
    document.getElementById('fieldModal').style.display = 'none'
    loadFields()
  } catch (err) {
    errEl.textContent = err.message || 'Gagal menyimpan lapangan.'
    errEl.style.display = 'block'
  } finally {
    setLoading(btn, false, 'Simpan Lapangan')
  }
}

async function deleteField() {
  if (!fieldToDelete) return
  const btn = document.getElementById('confirmDeleteBtn')
  btn.disabled = true; btn.textContent = 'Menghapus...'
  try {
    const { error } = await supabase.from('fields').delete().eq('id', fieldToDelete)
    if (error) throw error
    showToast('Lapangan berhasil dihapus.', 'success')
    document.getElementById('deleteModal').style.display = 'none'
    loadFields()
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error')
  } finally {
    btn.disabled = false; btn.textContent = 'Hapus Lapangan'
  }
}

init()
