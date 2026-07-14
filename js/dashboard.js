// dashboard.js

// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// Streak dots
const streakData = [true, true, true, false, true, true, false];
const days = ['S','M','T','W','T','F','S'];
const streakEl = document.getElementById('streakDots');
if (streakEl) {
  streakData.forEach((done, i) => {
    const dot = document.createElement('div');
    dot.className = 'streak-dot';
    dot.style.background = done ? 'var(--success)' : 'var(--border)';
    dot.title = days[i];
    streakEl.appendChild(dot);
  });
}

// Mini rings (CSS custom property approach)
document.querySelectorAll('.mini-ring').forEach(ring => {
  const pct = parseInt(ring.dataset.pct || '0');
  ring.style.background = `conic-gradient(var(--teal) ${pct}%, var(--border) 0)`;
  ring.title = pct + '%';
});

// Progress chart
const progressCtx = document.getElementById('progressChart')?.getContext('2d');
let progressChartInstance = null;

function setPageUserHeader(user) {
  if (!user) return;
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials = `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase();

  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) userNameEl.textContent = name;
  if (userRoleEl) userRoleEl.textContent = user.role || '';
  if (userAvatarEl) userAvatarEl.textContent = initials || 'A';

  const settingsName = document.querySelector('input[type="text"][name="full_name"], input[type="text"]#accountFullName');
  const settingsEmail = document.querySelector('input[type="email"][name="email"], input[type="email"]#accountEmail');
  const settingsPhone = document.querySelector('input[type="tel"][name="phone"], input[type="tel"]#accountPhone');
  if (settingsName) settingsName.value = name;
  if (settingsEmail) settingsEmail.value = user.email || '';
  if (settingsPhone) settingsPhone.value = user.phone || '';
}

async function saveAccountSettings() {
  const fullName = document.getElementById('accountFullName')?.value.trim() || '';
  const email = document.getElementById('accountEmail')?.value.trim() || '';
  const phone = document.getElementById('accountPhone')?.value.trim() || '';
  if (!fullName || !email) {
    alert('Please provide both full name and email address.');
    return;
  }

  const parts = fullName.split(' ').filter(Boolean);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ') || '';

  try {
    const res = await fetch('php/me.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone })
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setPageUserHeader(data.user);
      alert('Profile settings saved successfully.');
    } else {
      alert(data.error || 'Unable to save settings.');
    }
  } catch (err) {
    console.error('Failed to save settings', err);
    alert('Unable to save settings.');
  }
}

function renderProgressChart(progress = []) {
  if (!progressCtx) return;
  const labels = progress.map(item => item.snap_date);
  const data = progress.map(item => Math.round(item.avg_quality || 0));

  if (progressChartInstance) progressChartInstance.destroy();
  progressChartInstance = new Chart(progressCtx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        label: 'Quality Score (%)',
        data: data.length ? data : [0],
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0,229,255,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00e5ff',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#8b9cbf' } },
        y: {
          min: 0, max: 100,
          grid: { color: '#1e2d45' },
          ticks: { color: '#8b9cbf', callback: v => v + '%' }
        }
      }
    }
  });
}

// Quick message send (demo)
const msgInput = document.getElementById('msgInput');
const msgSend  = document.getElementById('msgSend');
const msgList  = document.getElementById('messageList');

if (msgSend && msgInput && msgList) {
  const sendMsg = () => {
    const txt = msgInput.value.trim();
    if (!txt) return;
    const div = document.createElement('div');
    div.className = 'msg msg-sent';
    div.innerHTML = `<div class="msg-body">${txt}</div><div class="msg-time">Just now</div>`;
    msgList.appendChild(div);
    msgList.scrollTop = msgList.scrollHeight;
    msgInput.value = '';
  };
  msgSend.addEventListener('click', sendMsg);
  msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
}

// ------------------------------
// Populate dashboard via php/me.php
// ------------------------------
async function populateDashboard() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (data.error) return;

    const user = data.user || {};
    setPageUserHeader(user);

    // If server returned preferences, apply them to settings UI and localStorage
    if (data.user && data.user.preferences) {
      const prefs = data.user.preferences;
      const elReceive = document.getElementById('prefReceiveReminders');
      const elRealtime = document.getElementById('prefRealtimeFeedback');
      const elDark = document.getElementById('prefDarkMode');
      if (elReceive) elReceive.checked = !!prefs.receive_reminders;
      if (elRealtime) elRealtime.checked = !!prefs.realtime_feedback;
      if (elDark) elDark.checked = !!prefs.dark_mode;
      localStorage.setItem('pref.receiveReminders', prefs.receive_reminders ? '1' : '0');
      localStorage.setItem('pref.realtimeFeedback', prefs.realtime_feedback ? '1' : '0');
      localStorage.setItem('pref.darkMode', prefs.dark_mode ? '1' : '0');
    }

    if (user.role === 'patient') {
      // populate patient dashboard
      const sessions = data.sessions || [];
      document.getElementById('todayPlanTitle') && (document.getElementById('todayPlanTitle').textContent = sessions[0] ? sessions[0].exercise : 'No session scheduled');
      document.getElementById('todayPlanDetails') && (document.getElementById('todayPlanDetails').textContent = sessions[0] ? `${sessions[0].total_reps || 0} reps · ${sessions[0].status || ''}` : '');

      // recent sessions
      const tbody = document.getElementById('sessionTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        for (const s of sessions) {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${new Date(s.started_at).toLocaleString()}</td><td>${s.exercise}</td><td>${s.total_reps||0}</td><td>${s.avg_quality||0}%</td><td>${s.status||''}</td>`;
          tbody.appendChild(tr);
        }
      }

      // progress and stats
      const progress = data.progress || [];
      let totalReps = 0, avg = 0;
      for (const p of progress) { totalReps += p.total_reps || 0; avg += (p.avg_quality || 0); }
      avg = progress.length ? Math.round(avg / progress.length) : 0;
      document.getElementById('totalReps') && (document.getElementById('totalReps').textContent = totalReps);
      document.getElementById('qualityScore') && (document.getElementById('qualityScore').textContent = avg + '%');
      document.getElementById('sessionsDone') && (document.getElementById('sessionsDone').textContent = sessions.length);
      document.getElementById('adherence') && (document.getElementById('adherence').textContent = `${avg}% adherence`);
      renderProgressChart(progress.reverse());

    } else if (user.role === 'clinician') {
      document.getElementById('totalPatients') && (document.getElementById('totalPatients').textContent = data.patient_count || 0);
      document.getElementById('sessionsToday') && (document.getElementById('sessionsToday').textContent = data.sessions_today || 0);
      document.getElementById('avgAdherence') && (document.getElementById('avgAdherence').textContent = (data.avg_adherence || 0) + '%');
      document.getElementById('adherenceBar') && (document.getElementById('adherenceBar').style.width = (data.avg_adherence || 0) + '%');

      // load patient list using existing helper if available
      if (typeof loadPatientList === 'function') loadPatientList();
    }

  } catch (err) {
    console.error('Failed to populate dashboard', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  populateDashboard();
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveAccountSettings);
});

// --- Preferences: load/save to localStorage for now ---
function loadPreferences() {
  const receive = localStorage.getItem('pref.receiveReminders') === '1';
  const realtime = localStorage.getItem('pref.realtimeFeedback') === '1';
  const dark = localStorage.getItem('pref.darkMode') === '1';
  const elReceive = document.getElementById('prefReceiveReminders');
  const elRealtime = document.getElementById('prefRealtimeFeedback');
  const elDark = document.getElementById('prefDarkMode');
  if (elReceive) elReceive.checked = receive;
  if (elRealtime) elRealtime.checked = realtime;
  if (elDark) elDark.checked = dark;
}

function savePreference(key, value) {
  localStorage.setItem(key, value ? '1' : '0');
  // Also attempt to persist server-side for logged-in users
  const shortKey = key.replace('pref.', '');
  const body = {};
  if (shortKey === 'receiveReminders') body.receive_reminders = value ? 1 : 0;
  if (shortKey === 'realtimeFeedback') body.realtime_feedback = value ? 1 : 0;
  if (shortKey === 'darkMode') body.dark_mode = value ? 1 : 0;
  if (Object.keys(body).length === 0) return;
  fetch('php/me.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).catch(() => {/* ignore network errors, localStorage still holds */});
}

document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  const elReceive = document.getElementById('prefReceiveReminders');
  const elRealtime = document.getElementById('prefRealtimeFeedback');
  const elDark = document.getElementById('prefDarkMode');
  if (elReceive) elReceive.addEventListener('change', e => savePreference('pref.receiveReminders', e.target.checked));
  if (elRealtime) elRealtime.addEventListener('change', e => savePreference('pref.realtimeFeedback', e.target.checked));
  if (elDark) elDark.addEventListener('change', e => savePreference('pref.darkMode', e.target.checked));
});

// ------------------------------
// Load exercise library for exercises.html
// ------------------------------
async function loadExercises() {
  const list = document.getElementById('exerciseList');
  if (!list) return;
  try {
    const res = await fetch('php/exercises_api.php?action=list');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    const exercises = data.exercises || [];
    list.innerHTML = '';
    for (const e of exercises) {
      const node = document.createElement('div');
      node.className = 'exercise-item';
      node.innerHTML = `<div class="ex-icon">🏋</div><div class="ex-info"><div class="ex-name">${e.name}</div><div class="ex-detail text-muted">${e.description || ''}</div></div><div class="ex-meta">${e.target_reps} reps · ${e.target_sets} sets</div>`;
      list.appendChild(node);
    }
  } catch (err) {
    console.error('Failed to load exercises', err);
  }
}

document.addEventListener('DOMContentLoaded', loadExercises);