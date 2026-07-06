// session.js - Live session logic

// ─── State ───────────────────────────────────────────────
let running  = false;
let repCount = 0;
let setNum   = 1;
let timerSec = 0;
let timerInterval = null;
let sessionInterval = null;
const REP_TARGET = 15;

// ─── DOM refs ────────────────────────────────────────────
const startBtn    = document.getElementById('startBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const endBtn      = document.getElementById('endBtn');
const repCountEl  = document.getElementById('repCount');
const setNumEl    = document.getElementById('setNum');
const repBarEl    = document.getElementById('repBar');
const timerEl     = document.getElementById('sessionTimer');
const kneeAngle   = document.getElementById('kneeAngle');
const hipAngle    = document.getElementById('hipAngle');
const formScoreLbl= document.getElementById('formScoreLabel');
const formScoreBar= document.getElementById('formScoreBar');
const qualityArc  = document.getElementById('qualityArc');
const qualityText = document.getElementById('qualityText');
const qualityLabel= document.getElementById('qualityLabel');
const feedbackBody= document.getElementById('feedbackBody');
const rhythmBars  = document.getElementById('rhythmBars');

// ─── Exercise select ─────────────────────────────────────
document.querySelectorAll('.ex-select-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.ex-select-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    resetReps();
  });
});

// ─── Rhythm bars init ────────────────────────────────────
if (rhythmBars) {
  for (let i = 0; i < 60; i++) {
    const bar = document.createElement('div');
    bar.className = 'rhythm-bar';
    bar.style.height = (Math.random() * 40 + 4) + 'px';
    rhythmBars.appendChild(bar);
  }
}

// ─── Camera ──────────────────────────────────────────────
const enableCamBtn   = document.getElementById('enableCam');
const camPlaceholder = document.getElementById('camPlaceholder');
const videoFeed      = document.getElementById('videoFeed');
const camBtn         = document.getElementById('camBtn');
let cameraOn = false;

async function enableCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoFeed.srcObject = stream;
    camPlaceholder.style.display = 'none';
    videoFeed.style.display = 'block';
    camBtn.textContent = '📷 Camera On';
    cameraOn = true;
  } catch {
    addFeedback('Could not access camera. Check browser permissions.', 'warn');
  }
}

enableCamBtn?.addEventListener('click', enableCamera);
camBtn?.addEventListener('click', () => {
  if (cameraOn) {
    videoFeed.srcObject?.getTracks().forEach(t => t.stop());
    videoFeed.srcObject = null;
    camPlaceholder.style.display = 'flex';
    videoFeed.style.display = 'none';
    camBtn.textContent = '📷 Camera Off';
    cameraOn = false;
  } else {
    enableCamera();
  }
});

// ─── Timer ───────────────────────────────────────────────
function updateTimer() {
  timerSec++;
  const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
  const s = String(timerSec % 60).padStart(2, '0');
  if (timerEl) timerEl.textContent = `${m}:${s}`;
}

// ─── Start / pause / end ─────────────────────────────────
startBtn?.addEventListener('click', () => {
  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  timerInterval    = setInterval(updateTimer, 1000);
  sessionInterval  = setInterval(simulateFrame, 800);
  addFeedback('Session started. Begin your exercise!', 'info');
});

pauseBtn?.addEventListener('click', () => {
  running = !running;
  pauseBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
  if (running) {
    timerInterval   = setInterval(updateTimer, 1000);
    sessionInterval = setInterval(simulateFrame, 800);
    addFeedback('Session resumed.', 'info');
  } else {
    clearInterval(timerInterval);
    clearInterval(sessionInterval);
    addFeedback('Session paused.', 'warn');
  }
});

endBtn?.addEventListener('click', () => {
  if (!confirm('End this session and save results?')) return;
  clearInterval(timerInterval);
  clearInterval(sessionInterval);
  window.location.href = 'dashboard.html';
});

// ─── Rep counting ────────────────────────────────────────
document.getElementById('manualRep')?.addEventListener('click', addRep);
document.getElementById('resetRep')?.addEventListener('click', resetReps);

function addRep() {
  repCount++;
  if (repCountEl) repCountEl.textContent = repCount;
  const pct = Math.min((repCount / REP_TARGET) * 100, 100);
  if (repBarEl) repBarEl.style.width = pct + '%';

  if (repCount >= REP_TARGET) {
    setNum++;
    if (setNum > 3) {
      addFeedback('All sets complete! Great work!', 'ok');
      setNum = 3;
    } else {
      addFeedback(`Set ${setNum - 1} complete! Starting set ${setNum}…`, 'ok');
    }
    resetReps(false);
    if (setNumEl) setNumEl.textContent = setNum;
  }
}

function resetReps(resetSet = true) {
  repCount = 0;
  if (resetSet) setNum = 1;
  if (repCountEl) repCountEl.textContent = '0';
  if (repBarEl)   repBarEl.style.width = '0%';
  if (setNumEl && resetSet) setNumEl.textContent = '1';
}

// ─── Simulated motion tracking inference (until MediaPipe is connected) ─
const feedbackMessages = [
  { msg: 'Good depth! Keep your back straight.', type: 'ok' },
  { msg: 'Lower your hips further.', type: 'warn' },
  { msg: 'Keep knees aligned with toes.', type: 'warn' },
  { msg: 'Excellent form, maintain this!', type: 'ok' },
  { msg: 'Straighten your posture.', type: 'warn' },
  { msg: 'Great tempo, smooth and controlled.', type: 'ok' },
];

let frameCount = 0;

function simulateFrame() {
  if (!running) return;
  frameCount++;

  // Simulate joint angles
  const knee = Math.round(80 + Math.random() * 30);
  const hip  = Math.round(65 + Math.random() * 25);
  if (kneeAngle) kneeAngle.textContent = knee + '°';
  if (hipAngle)  hipAngle.textContent  = hip + '°';

  // Simulate quality score
  const quality = Math.round(70 + Math.random() * 20);
  setQualityScore(quality);

  // Simulate form score bar
  const formScore = Math.round(65 + Math.random() * 25);
  if (formScoreLbl) {
    formScoreLbl.textContent = formScore + '%';
    formScoreLbl.style.color = formScore >= 80 ? 'var(--success)' : formScore >= 65 ? 'var(--warning)' : 'var(--danger)';
  }
  if (formScoreBar) formScoreBar.style.width = formScore + '%';

  // Rhythm bars animation
  if (rhythmBars) {
    const bars = rhythmBars.querySelectorAll('.rhythm-bar');
    bars.forEach((bar, i) => {
      bar.style.height = (Math.random() * 44 + 4) + 'px';
      bar.classList.toggle('active', i === frameCount % bars.length);
    });
  }

  // Every ~4 frames, add rep + feedback
  if (frameCount % 4 === 0) {
    addRep();
    const fb = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];
    addFeedback(fb.msg, fb.type);
  }
}

function setQualityScore(pct) {
  // Arc: circumference 251.2, dashoffset = 251.2 * (1 - pct/100)
  const offset = 251.2 * (1 - pct / 100);
  if (qualityArc) {
    qualityArc.style.strokeDashoffset = offset;
    qualityArc.style.stroke = pct >= 80 ? 'var(--success)' : pct >= 65 ? 'var(--warning)' : 'var(--danger)';
  }
  if (qualityText) qualityText.textContent = pct + '%';
  if (qualityLabel) {
    qualityLabel.textContent = pct >= 80 ? 'Excellent' : pct >= 65 ? 'Needs work' : 'Poor form';
    qualityLabel.style.color = pct >= 80 ? 'var(--success)' : pct >= 65 ? 'var(--warning)' : 'var(--danger)';
  }
}

function addFeedback(msg, type = 'info') {
  if (!feedbackBody) return;
  const icons = { ok: '✓', warn: '⚠', info: 'ℹ' };
  const div = document.createElement('div');
  div.className = `feedback-msg ${type}`;
  div.innerHTML = `<span class="feedback-icon">${icons[type] || 'ℹ'}</span> ${msg}`;
  feedbackBody.insertBefore(div, feedbackBody.firstChild);
  // Keep only latest 6
  while (feedbackBody.children.length > 6) {
    feedbackBody.removeChild(feedbackBody.lastChild);
  }
}