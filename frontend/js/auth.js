// Login handler
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuth(data.token, data.user);
    showToast('Login berhasil!', 'success');
    setTimeout(() => {
      window.location.href = data.user.role === 'admin' ? 'dashboard-admin.html' : 'dashboard-pasien.html';
    }, 500);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

// Register handler
async function handleRegister(e) {
  e.preventDefault();
  const nama = document.getElementById('nama').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const role = document.getElementById('role').value;
  const no_telp = document.getElementById('no_telp').value;

  if (password !== confirmPassword) {
    showToast('Password tidak cocok!', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('Password minimal 6 karakter!', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nama, email, password, role, no_telp })
    });
    setAuth(data.token, data.user);
    showToast('Registrasi berhasil!', 'success');
    setTimeout(() => {
      window.location.href = data.user.role === 'admin' ? 'dashboard-admin.html' : 'dashboard-pasien.html';
    }, 500);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Daftar';
  }
}

function logout() {
  clearAuth();
  window.location.href = 'login.html';
}

// Auth guard
function requireAuth(role) {
  if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
  const user = getUser();
  if (role && user.role !== role) {
    window.location.href = user.role === 'admin' ? 'dashboard-admin.html' : 'dashboard-pasien.html';
    return false;
  }
  return true;
}
