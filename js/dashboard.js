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
if (progressCtx) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data   = [72, 78, 74, 85, 81, 87, 82];

  new Chart(progressCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Quality Score (%)',
        data,
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
          min: 50, max: 100,
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