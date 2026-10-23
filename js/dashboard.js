// dashboard.js

// Mini rings (CSS custom property approach)
document.querySelectorAll('.mini-ring').forEach(ring => {
  const pct = parseInt(ring.dataset.pct || '0');
  ring.style.background = `conic-gradient(var(--teal) ${pct}%, var(--border) 0)`;
  ring.title = pct + '%';
});

// Progress chart
const progressCtx = document.getElementById('progressChart')?.getContext('2d');
let progressChartInstance = null;
let currentProgressData = [];

function setPageUserHeader(user) {
  if (!user) return;
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials = `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase();
  const greeting = document.getElementById('dashboardGreeting');

  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) userNameEl.textContent = name;
  if (userRoleEl) userRoleEl.textContent = user.role || '';
  if (userAvatarEl) userAvatarEl.textContent = initials || 'A';
  if (greeting) {
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greeting.textContent = `${salutation}, ${user.first_name || 'Patient'}!`;
  }

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
  currentProgressData = [...progress];
  const metric = document.getElementById('progressMetric')?.value || 'quality';
  const isReps = metric === 'reps';
  const labels = currentProgressData.map(item => item.snap_date);
  const data = currentProgressData.map(item => Math.round(isReps ? item.total_reps || 0 : item.avg_quality || 0));

  if (progressChartInstance) progressChartInstance.destroy();
  progressChartInstance = new Chart(progressCtx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        label: isReps ? 'Repetitions' : 'Quality Score (%)',
        data: data.length ? data : [0],
        borderColor: '#c43d50',
        backgroundColor: 'rgba(196,61,80,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#c43d50',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0d7da' }, ticks: { color: '#725b62' } },
        y: {
          beginAtZero: true,
          ...(isReps ? {} : { min: 0, max: 100 }),
          grid: { color: '#f0d7da' },
          ticks: { color: '#725b62', callback: v => isReps ? v : `${v}%` }
        }
      }
    }
  });
}

document.getElementById('progressMetric')?.addEventListener('change', () => {
  renderProgressChart(currentProgressData);
});

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
    const patientPage = ['dashboard.html', 'progress.html', 'exercises.html']
      .some(page => window.location.pathname.endsWith(page));
    if (user.role === 'clinician' && patientPage) {
      window.location.replace('clinician.html');
      return;
    }

    // If server returned preferences, apply them to settings UI and localStorage
    if (data.user && data.user.preferences) {
      const prefs = data.user.preferences;
      const elRealtime = document.getElementById('prefRealtimeFeedback');
      const elDark = document.getElementById('prefDarkMode');
      if (elRealtime) elRealtime.checked = !!prefs.realtime_feedback;
      if (elDark) elDark.checked = !!prefs.dark_mode;
      localStorage.setItem('pref.receiveReminders', prefs.receive_reminders ? '1' : '0');
      localStorage.setItem('pref.realtimeFeedback', prefs.realtime_feedback ? '1' : '0');
      localStorage.setItem('pref.darkMode', prefs.dark_mode ? '1' : '0');
    }

    if (user.role === 'patient') {
      // populate patient dashboard
      const sessions = data.sessions || [];
      renderStreak(data.progress || []);
      document.getElementById('todayPlanTitle') && (document.getElementById('todayPlanTitle').textContent = sessions[0] ? sessions[0].exercise : 'No sessions yet');
      document.getElementById('todayPlanDetails') && (document.getElementById('todayPlanDetails').textContent = sessions[0] ? `Last session · ${sessions[0].total_reps || 0} reps · ${sessions[0].status || ''}` : 'Start a session to see your activity here.');

      // recent sessions
      const tbody = document.getElementById('sessionTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        for (const s of sessions) {
          const tr = document.createElement('tr');
          const values = [
            new Date(s.started_at).toLocaleString(),
            s.exercise || '',
            s.total_reps || 0,
            `${s.avg_quality || 0}%`,
            s.status || ''
          ];
          values.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        }
      }

      // progress and stats
      const progress = data.progress || [];
      let totalReps = 0, avg = 0;
      for (const p of progress) { totalReps += p.total_reps || 0; avg += (p.avg_quality || 0); }
      avg = progress.length ? Math.round(avg / progress.length) : 0;
      const adherenceDays = progress.filter(item => Number(item.sessions_done || 0) > 0).length;
      const adherence = Math.round(Math.min(100, adherenceDays / 7 * 100));
      const sessionsThisWeek = progress.reduce((sum, item) => sum + Number(item.sessions_done || 0), 0);
      document.getElementById('totalReps') && (document.getElementById('totalReps').textContent = totalReps);
      document.getElementById('qualityScore') && (document.getElementById('qualityScore').textContent = avg + '%');
      document.getElementById('sessionsDone') && (document.getElementById('sessionsDone').textContent = sessionsThisWeek);
      document.getElementById('adherence') && (document.getElementById('adherence').textContent = `${adherence}% weekly activity`);
      document.getElementById('qualityBar') && (document.getElementById('qualityBar').style.width = `${avg}%`);
      renderProgressChart(progress.reverse());
      renderProgressSummary(progress, sessions, adherence);
    }

  } catch (err) {
    console.error('Failed to populate dashboard', err);
  }
}

function renderStreak(progress) {
  const dots = document.getElementById('streakDots');
  const completed = new Set(
    progress
      .filter(item => Number(item.sessions_done || 0) > 0)
      .map(item => String(item.snap_date).slice(0, 10))
  );
  const streak = calculateCurrentStreak(progress);
  if (!dots) {
    const streakNum = document.getElementById('streakNum');
    if (streakNum) streakNum.textContent = streak;
    return;
  }

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dots.replaceChildren();

  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dot = document.createElement('div');
    dot.className = 'streak-dot';
    dot.style.background = completed.has(key) ? 'var(--success)' : 'var(--border)';
    dot.title = `${dayLabels[i]} ${key}`;
    dots.appendChild(dot);
  }

  const streakNum = document.getElementById('streakNum');
  if (streakNum) streakNum.textContent = streak;
}

function calculateCurrentStreak(progress) {
  const completed = new Set(
    progress
      .filter(item => Number(item.sessions_done || 0) > 0)
      .map(item => String(item.snap_date).slice(0, 10))
  );
  const countFrom = new Date();
  countFrom.setHours(0, 0, 0, 0);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  if (!completed.has(dateKey(countFrom))) countFrom.setDate(countFrom.getDate() - 1);
  let streak = 0;
  while (completed.has(dateKey(countFrom))) {
    streak++;
    countFrom.setDate(countFrom.getDate() - 1);
  }
  return streak;
}

function renderProgressSummary(progress, sessions, adherence) {
  const container = document.getElementById('statsContainer');
  if (!container) return;
  const totalReps = progress.reduce((sum, item) => sum + Number(item.total_reps || 0), 0);
  const avgQuality = progress.length
    ? Math.round(progress.reduce((sum, item) => sum + Number(item.avg_quality || 0), 0) / progress.length)
    : 0;
  const completedSessions = sessions.filter(session => session.status === 'completed').length;
  const currentStreak = calculateCurrentStreak(progress);
  const items = [
    ['Total Reps (7 days)', totalReps],
    ['Average Quality', `${avgQuality}%`],
    ['Completed Sessions', completedSessions],
    ['Weekly Activity', `${adherence}%`],
    ['Current Streak', `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`]
  ];
  container.replaceChildren();
  for (const [label, value] of items) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const heading = document.createElement('div');
    heading.className = 'stat-card-label';
    heading.textContent = label;
    const number = document.createElement('div');
    number.className = 'stat-card-num';
    number.textContent = value;
    card.append(heading, number);
    container.appendChild(card);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  populateDashboard();
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveAccountSettings);
});

// --- Preferences: load/save to localStorage for now ---
function loadPreferences() {
  const realtime = localStorage.getItem('pref.realtimeFeedback') === '1';
  const dark = localStorage.getItem('pref.darkMode') === '1';
  const elRealtime = document.getElementById('prefRealtimeFeedback');
  const elDark = document.getElementById('prefDarkMode');
  if (elRealtime) elRealtime.checked = realtime;
  if (elDark) elDark.checked = dark;
}

async function savePreference(key, value) {
  localStorage.setItem(key, value ? '1' : '0');
  // Also attempt to persist server-side for logged-in users
  const shortKey = key.replace('pref.', '');
  const body = {};
  if (shortKey === 'receiveReminders') body.receive_reminders = value ? 1 : 0;
  if (shortKey === 'realtimeFeedback') body.realtime_feedback = value ? 1 : 0;
  if (shortKey === 'darkMode') body.dark_mode = value ? 1 : 0;
  if (Object.keys(body).length === 0) return;
  try {
    const response = await fetch('php/me.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Unable to save preference.');
  } catch (err) {
    console.error('Failed to save preference', err);
    alert(err.message || 'Unable to save preference.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  const elRealtime = document.getElementById('prefRealtimeFeedback');
  const elDark = document.getElementById('prefDarkMode');
  if (elRealtime) elRealtime.addEventListener('change', e => savePreference('pref.realtimeFeedback', e.target.checked));
  if (elDark) elDark.addEventListener('change', e => savePreference('pref.darkMode', e.target.checked));
});

// ------------------------------
// Load exercise library for exercises.html
// ------------------------------
async function loadExercises() {
  const list = document.getElementById('exerciseList');
  if (!list) return;
  const exerciseIcons = {
    squat: '🦵',
    lunge: '🚶',
    'knee-ext': '🪑'
  };
  try {
    const res = await fetch('php/exercises_api.php?action=list');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Unable to load exercises.');
    const exercises = data.exercises || [];
    list.innerHTML = '';
    for (const e of exercises) {
      const node = document.createElement('div');
      node.className = 'exercise-item';
      const icon = document.createElement('div');
      icon.className = 'ex-icon';
      icon.textContent = exerciseIcons[e.slug] || '🏋';
      icon.setAttribute('aria-hidden', 'true');
      const info = document.createElement('div');
      info.className = 'ex-info';
      const name = document.createElement('div');
      name.className = 'ex-name';
      name.textContent = e.name;
      const detail = document.createElement('div');
      detail.className = 'ex-detail text-muted';
      detail.textContent = e.description || '';
      info.append(name, detail);
      const meta = document.createElement('div');
      meta.className = 'ex-meta';
      meta.textContent = `${e.target_reps} reps · ${e.target_sets} sets`;
      node.append(icon, info, meta);
      list.appendChild(node);
    }
  } catch (err) {
    console.error('Failed to load exercises', err);
    list.textContent = 'Could not load exercises. Please refresh the page.';
  }
}

document.addEventListener('DOMContentLoaded', loadExercises);