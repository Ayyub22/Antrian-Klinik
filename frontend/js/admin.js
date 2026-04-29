// Admin Dashboard Logic
let queuesData = [];
let doctorsData = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('admin')) return;
  const user = getUser();
  document.getElementById('userName').textContent = user.nama;
  requestNotificationPermission();
  initRealtime();
  loadDashboard();
  setupSidebar();
});

function setupSidebar() {
  const links = document.querySelectorAll('.sidebar-nav a[data-section]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('hidden'));
      document.getElementById(section).classList.remove('hidden');
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      if (section === 'section-doctors') loadDoctors();
      if (section === 'section-queues') loadDashboard();
    });
  });
  // Hamburger
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger) {
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.querySelector('.main-content').addEventListener('click', () => sidebar.classList.remove('open'));
  }
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/queues/today');
    queuesData = data.queues || [];
    renderStats();
    renderQueues();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStats() {
  let totalWaiting = 0, totalServing = 0, totalDone = 0, totalAll = 0;
  queuesData.forEach(q => {
    (q.tickets || []).forEach(t => {
      totalAll++;
      if (t.status === 'waiting') totalWaiting++;
      if (t.status === 'serving') totalServing++;
      if (t.status === 'done') totalDone++;
    });
  });
  document.getElementById('statTotal').textContent = totalAll;
  document.getElementById('statWaiting').textContent = totalWaiting;
  document.getElementById('statServing').textContent = totalServing;
  document.getElementById('statDone').textContent = totalDone;
}

function renderQueues() {
  const container = document.getElementById('queuesList');
  const containerAlt = document.getElementById('queuesListAlt');
  const emptyHtml = `<div class="empty-state"><div class="icon">📋</div><h3>Belum ada antrian hari ini</h3><p>Buat sesi antrian baru untuk memulai</p></div>`;
  if (queuesData.length === 0) {
    container.innerHTML = emptyHtml;
    if (containerAlt) containerAlt.innerHTML = emptyHtml;
    return;
  }
  let html = '';
  queuesData.forEach(q => {
    const doctor = q.doctors || {};
    const tickets = q.tickets || [];
    const waiting = tickets.filter(t => t.status === 'waiting');
    const serving = tickets.find(t => t.status === 'serving');
    html += `
    <div class="glass-card" style="margin-bottom:20px">
      <div class="flex justify-between items-center" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">
        <div>
          <h3>${doctor.nama || 'Dokter'}</h3>
          <p style="color:var(--accent-blue);font-size:14px">${doctor.spesialis || ''}</p>
        </div>
        <div class="flex gap-1">
          <span class="badge badge-${q.status}">${q.status}</span>
          ${q.status === 'open' ? `<button class="btn btn-primary btn-sm" onclick="callNext('${q.id}')">Panggil</button>
          <button class="btn btn-secondary btn-sm" onclick="closeQueue('${q.id}')">Tutup Sesi</button>` : ''}
        </div>
      </div>
      <div class="queue-display glass-card" style="padding:20px;margin-bottom:16px">
        <div style="font-size:14px;color:var(--text-secondary)">Nomor Saat Ini</div>
        <div class="queue-number" style="font-size:64px">${q.current_number || '-'}</div>
        ${serving ? `<div style="margin-top:8px;color:var(--accent-emerald)">🟢 ${serving.users?.nama || 'Pasien'}</div>` : ''}
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>No</th><th>Pasien</th><th>Telp</th><th>Status</th><th>Waktu</th><th>Aksi</th></tr></thead>
          <tbody>
            ${tickets.map(t => `<tr>
              <td><strong>${t.nomor}</strong></td>
              <td>${t.users?.nama || '-'}</td>
              <td>${t.users?.no_telp || '-'}</td>
              <td><span class="badge badge-${t.status}">${t.status}</span></td>
              <td>${formatTime(t.waktu_ambil)}</td>
              <td>
                ${t.status === 'waiting' ? `<button class="btn btn-sm btn-warning" onclick="skipTicket('${t.id}')">Skip</button>` : ''}
                ${t.status === 'serving' ? `<button class="btn btn-sm btn-success" onclick="doneTicket('${t.id}')">Selesai</button>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  });
  container.innerHTML = html;
  if (containerAlt) containerAlt.innerHTML = html;
}

async function callNext(queueId) {
  try {
    const data = await apiFetch(`/queues/${queueId}/call`, { method: 'PUT' });
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function skipTicket(ticketId) {
  try {
    await apiFetch(`/queues/${ticketId}/skip`, { method: 'PUT' });
    showToast('Pasien di-skip', 'info');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function doneTicket(ticketId) {
  try {
    await apiFetch(`/queues/${ticketId}/done`, { method: 'PUT' });
    showToast('Pasien selesai dilayani', 'success');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function closeQueue(queueId) {
  if (!confirm('Tutup sesi antrian ini?')) return;
  try {
    await apiFetch(`/queues/${queueId}/close`, { method: 'PUT' });
    showToast('Sesi antrian ditutup', 'info');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

// Create queue session
async function showCreateQueue() {
  try {
    const data = await apiFetch('/doctors');
    doctorsData = data.doctors || [];
    const select = document.getElementById('selectDoctor');
    select.innerHTML = '<option value="">Pilih Dokter...</option>' +
      doctorsData.map(d => `<option value="${d.id}">${d.nama} - ${d.spesialis}</option>`).join('');
    document.getElementById('createQueueModal').classList.remove('hidden');
  } catch (err) { showToast(err.message, 'error'); }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function handleCreateQueue(e) {
  e.preventDefault();
  const doctor_id = document.getElementById('selectDoctor').value;
  if (!doctor_id) { showToast('Pilih dokter!', 'error'); return; }
  try {
    await apiFetch('/queues/create', { method: 'POST', body: JSON.stringify({ doctor_id }) });
    showToast('Sesi antrian berhasil dibuat!', 'success');
    closeModal('createQueueModal');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

// Doctor management
async function loadDoctors() {
  try {
    const data = await apiFetch('/doctors');
    doctorsData = data.doctors || [];
    renderDoctors();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderDoctors() {
  const container = document.getElementById('doctorsList');
  if (doctorsData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">👨‍⚕️</div><h3>Belum ada dokter</h3></div>';
    return;
  }
  container.innerHTML = `<div class="table-wrapper glass-card"><table>
    <thead><tr><th>Nama</th><th>Spesialis</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>${doctorsData.map(d => `<tr>
      <td><strong>${d.nama}</strong></td>
      <td>${d.spesialis}</td>
      <td><span class="badge ${d.is_active ? 'badge-open' : 'badge-closed'}">${d.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteDoctor('${d.id}')">Hapus</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function showAddDoctor() { document.getElementById('addDoctorModal').classList.remove('hidden'); }

async function handleAddDoctor(e) {
  e.preventDefault();
  const nama = document.getElementById('doctorNama').value;
  const spesialis = document.getElementById('doctorSpesialis').value;
  if (!nama || !spesialis) { showToast('Lengkapi data!', 'error'); return; }
  try {
    await apiFetch('/doctors', { method: 'POST', body: JSON.stringify({ nama, spesialis }) });
    showToast('Dokter berhasil ditambahkan!', 'success');
    closeModal('addDoctorModal');
    e.target.reset();
    loadDoctors();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteDoctor(id) {
  if (!confirm('Hapus dokter ini?')) return;
  try {
    await apiFetch(`/doctors/${id}`, { method: 'DELETE' });
    showToast('Dokter dihapus', 'info');
    loadDoctors();
  } catch (err) { showToast(err.message, 'error'); }
}

// Realtime callback
function onQueueUpdate(payload) { loadDashboard(); }
function onTicketUpdate(payload) { loadDashboard(); }
