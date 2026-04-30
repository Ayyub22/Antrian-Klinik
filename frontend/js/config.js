// KlinikQ Frontend Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const CONFIG = {
  API_URL: isLocal ? 'http://localhost:3000/api' : window.location.origin + '/api',
  SUPABASE_URL: 'https://xjvsmsyklnoslmupnlxn.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqdnNtc3lrbG5vc2xtdXBubHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjc3ODAsImV4cCI6MjA5MjgwMzc4MH0.GO6FeIzIDw-nFPDe49jPNYU9lYyyKwM0Sovh_ZIogVE',
  AVG_MINUTES_PER_PATIENT: 10
};

// Auth helpers
function getToken() { return localStorage.getItem('qe_token'); }
function getUser() {
  const u = localStorage.getItem('qe_user');
  return u ? JSON.parse(u) : null;
}
function setAuth(token, user) {
  localStorage.setItem('qe_token', token);
  localStorage.setItem('qe_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('qe_token');
  localStorage.removeItem('qe_user');
}
function isLoggedIn() { return !!getToken(); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

// API fetch wrapper
async function apiFetch(endpoint, options = {}) {
  const url = CONFIG.API_URL + endpoint;
  const defaults = { headers: authHeaders() };
  const res = await fetch(url, { ...defaults, ...options });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    clearAuth();
    showToast('Sesi Anda telah berakhir. Silakan login kembali.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    throw new Error('Sesi expired');
  }
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// Toast notification
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
