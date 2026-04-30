// Pasien Dashboard Logic
let myTickets = [];
let availableQueues = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('pasien')) return;
  const user = getUser();
  document.getElementById('userName').textContent = user.nama;
  requestNotificationPermission();
  initRealtime();
  loadPasienDashboard();
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
      if (section === 'section-ambil') loadAvailableQueues();
    });
  });
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger) {
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.querySelector('.main-content').addEventListener('click', () => sidebar.classList.remove('open'));
  }
}

async function loadPasienDashboard() {
  try {
    const data = await apiFetch('/queues/my-tickets');
    myTickets = data.tickets || [];
    renderMyTickets();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderMyTickets() {
  const container = document.getElementById('myTickets');
  const activeTickets = myTickets.filter(t => ['waiting', 'called', 'serving'].includes(t.status));
  const historyTickets = myTickets.filter(t => ['done', 'skipped', 'cancelled'].includes(t.status));

  if (activeTickets.length === 0 && historyTickets.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🎫</div><h3>Belum ada antrian</h3><p>Ambil nomor antrian untuk memulai</p></div>`;
    return;
  }

  let html = '';
  // Active tickets
  activeTickets.forEach(t => {
    const q = t.queues || {};
    const doc = q.doctors || {};
    const position = t.position || 0;
    const currentNum = q.current_number || 0;
    const totalWaiting = q.last_number - currentNum;
    const progress = totalWaiting > 0 ? Math.max(0, (1 - (position - 1) / totalWaiting) * 100) : 100;

    html += `
    <div class="ticket-card glass-card" style="margin-bottom:20px">
      <div style="margin-bottom:12px">
        <span class="badge badge-${t.status}">${t.status}</span>
      </div>
      <div class="ticket-number">${t.nomor}</div>
      <div class="ticket-info">
        <p>Dokter: <strong>${doc.nama || '-'}</strong></p>
        <p>Spesialis: <strong>${doc.spesialis || '-'}</strong></p>
        <p>Nomor Saat Ini: <strong style="color:var(--accent-emerald)">${currentNum || '-'}</strong></p>
        ${t.status === 'waiting' ? `
          <p>Posisi Anda: <strong style="color:var(--accent-amber)">${position}</strong></p>
          <p>Estimasi Tunggu: <strong>${t.estimasi_waktu || '-'}</strong></p>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
        ` : ''}
        ${t.status === 'serving' ? '<p style="color:var(--accent-emerald);font-size:18px;font-weight:700;margin-top:12px">🟢 Anda sedang dipanggil!</p>' : ''}
      </div>
      ${t.status === 'waiting' ? `<button class="btn btn-danger btn-block" style="margin-top:16px" onclick="cancelTicket('${t.id}')">Batalkan Antrian</button>` : ''}
    </div>`;
  });

  // History
  if (historyTickets.length > 0) {
    html += `<div class="section" style="margin-top:24px"><h3 style="margin-bottom:16px">Riwayat Antrian</h3>
    <div class="table-wrapper glass-card"><table>
      <thead><tr><th>No</th><th>Dokter</th><th>Status</th><th>Waktu</th></tr></thead>
      <tbody>${historyTickets.slice(0, 10).map(t => `<tr>
        <td><strong>${t.nomor}</strong></td>
        <td>${t.queues?.doctors?.nama || '-'}</td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td>${formatDate(t.waktu_ambil)}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
  }

  container.innerHTML = html;
}

async function loadAvailableQueues() {
  try {
    const data = await apiFetch('/queues/today');
    availableQueues = (data.queues || []).filter(q => q.status === 'open');
    renderAvailableQueues();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderAvailableQueues() {
  const container = document.getElementById('availableQueues');
  if (availableQueues.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🏥</div><h3>Tidak ada antrian tersedia</h3><p>Belum ada sesi antrian yang dibuka hari ini</p></div>`;
    return;
  }
  container.innerHTML = `<div class="doctor-grid">${availableQueues.map(q => {
    const doc = q.doctors || {};
    const initial = (doc.nama || 'D').charAt(0);
    return `<div class="glass-card doctor-card" onclick="takeQueue('${q.id}', '${doc.nama}', '${doc.spesialis}')">
      <div class="doctor-avatar">${initial}</div>
      <h3>${doc.nama || 'Dokter'}</h3>
      <p class="specialist">${doc.spesialis || ''}</p>
      <div class="queue-info">
        <p>Antrian saat ini: <strong>${q.current_number || 0}</strong></p>
        <p>Total antrian: <strong>${q.last_number || 0}</strong></p>
        <p>Menunggu: <strong>${q.waiting_count || 0}</strong> pasien</p>
      </div>
    </div>`;
  }).join('')}</div>`;
}

async function takeQueue(queueId, doctorName, specialist) {
  if (!confirm(`Ambil nomor antrian untuk ${doctorName} (${specialist})?`)) return;
  try {
    const data = await apiFetch('/queues/take', {
      method: 'POST',
      body: JSON.stringify({ queue_id: queueId })
    });
    showToast(`${data.message} Nomor Anda: ${data.ticket.nomor}`, 'success');
    // Switch to my tickets view
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('section-status').classList.remove('hidden');
    document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-section="section-status"]').classList.add('active');
    loadPasienDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function cancelTicket(ticketId) {
  if (!confirm('Batalkan antrian Anda?')) return;
  try {
    await apiFetch(`/queues/${ticketId}/cancel`, { method: 'PUT' });
    showToast('Antrian dibatalkan', 'info');
    loadPasienDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

// Realtime callbacks
function onQueueUpdate(payload) { loadPasienDashboard(); }
function onTicketUpdate(payload) {
  const newData = payload.new;
  const user = getUser();
  // Check if this is my ticket being updated
  if (newData && newData.user_id === user.id) {
    loadPasienDashboard();
  }
  // Check if queue current_number changed (from queue update)
  const activeTicket = myTickets.find(t => t.status === 'waiting');
  if (activeTicket && payload.table === 'queues') {
    checkAlmostCalled(newData.current_number, activeTicket.nomor);
  }
  loadPasienDashboard();
}
