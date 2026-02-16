const loginCard = document.getElementById('loginCard');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginFeedback = document.getElementById('loginFeedback');
const dashboardFeedback = document.getElementById('dashboardFeedback');
const tableBody = document.getElementById('signupTableBody');
const totalCount = document.getElementById('totalCount');
const latestSignup = document.getElementById('latestSignup');

let refreshTimer = null;

function getApiBase() {
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:3000';
  return '';
}

function getAuthToken() {
  return localStorage.getItem('sellerTrackerAdminAuth') || '';
}

function setAuthToken(username, password) {
  const token = btoa(`${username}:${password}`);
  localStorage.setItem('sellerTrackerAdminAuth', token);
  return token;
}

function clearAuth() {
  localStorage.removeItem('sellerTrackerAdminAuth');
}

function setLoggedIn(isLoggedIn) {
  loginCard.classList.toggle('hidden', isLoggedIn);
  dashboard.classList.toggle('hidden', !isLoggedIn);
}

async function fetchSignups(showSuccess = false) {
  const token = getAuthToken();
  if (!token) {
    setLoggedIn(false);
    return;
  }

  dashboardFeedback.textContent = '';

  try {
    const response = await fetch(`${getApiBase()}/api/signups`, {
      headers: { Authorization: `Basic ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      clearAuth();
      setLoggedIn(false);
      loginFeedback.textContent = 'Session expired or invalid credentials.';
      return;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load signups');

    renderSignups(data.signups || []);
    if (showSuccess) {
      dashboardFeedback.textContent = 'Signup data refreshed.';
      dashboardFeedback.className = 'feedback success';
      setTimeout(() => (dashboardFeedback.textContent = ''), 1200);
    }
  } catch (error) {
    dashboardFeedback.textContent = 'Could not reach server. Ensure backend is running and reachable.';
    dashboardFeedback.className = 'feedback';
  }
}

function renderSignups(signups) {
  tableBody.innerHTML = '';
  totalCount.textContent = String(signups.length);

  if (!signups.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5">No signups yet.</td>';
    tableBody.appendChild(row);
    latestSignup.textContent = '—';
    return;
  }

  const sorted = [...signups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  latestSignup.textContent = sorted[0].email || '—';

  sorted.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.id ?? ''}</td>
      <td>${item.name ?? ''}</td>
      <td>${item.email ?? ''}</td>
      <td>${item.source ?? ''}</td>
      <td>${new Date(item.createdAt).toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
  });
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => fetchSignups(false), 15000);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

loginBtn.addEventListener('click', async () => {
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value;

  if (!username || !password) {
    loginFeedback.textContent = 'Please enter username and password.';
    return;
  }

  const token = setAuthToken(username, password);

  try {
    const response = await fetch(`${getApiBase()}/api/signups`, {
      headers: { Authorization: `Basic ${token}` }
    });

    if (!response.ok) {
      clearAuth();
      loginFeedback.textContent = 'Invalid credentials.';
      return;
    }

    loginFeedback.textContent = '';
    setLoggedIn(true);
    await fetchSignups(true);
    startAutoRefresh();
  } catch (error) {
    clearAuth();
    loginFeedback.textContent = 'Could not connect to backend. Start server with npm start.';
  }
});

refreshBtn.addEventListener('click', () => fetchSignups(true));

logoutBtn.addEventListener('click', () => {
  clearAuth();
  stopAutoRefresh();
  setLoggedIn(false);
  loginFeedback.textContent = 'Logged out.';
});

(async function init() {
  if (getAuthToken()) {
    setLoggedIn(true);
    await fetchSignups(false);
    startAutoRefresh();
  } else {
    setLoggedIn(false);
  }
})();
