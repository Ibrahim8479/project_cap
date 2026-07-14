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
const poseCanvas     = document.getElementById('poseCanvas');
const canvasCtx      = poseCanvas?.getContext('2d');
let mpPose = null;
let mpCamera = null;
let cameraOn = false;
let activeSessionId = null;
let selectedExercise = 'squat';
let sessionStartTime = 0;
let lastSaveTime = 0;
let repState = 'up';
let lastRepTime = 0;
let lastInferenceTime = 0;
let inferenceCooldown = 5000;
let currentExercisePrediction = null;

function setPageUserHeader(user) {
  if (!user) return;
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  if (userNameEl) userNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (userRoleEl) userRoleEl.textContent = user.role || '';
}

async function loadCurrentUser() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (data && data.user) setPageUserHeader(data.user);
  } catch (err) {
    console.error('Failed to load current user', err);
  }
}

function updateCanvasSize() {
  if (!poseCanvas || !videoFeed) return;
  const width = videoFeed.videoWidth || videoFeed.clientWidth || 640;
  const height = videoFeed.videoHeight || videoFeed.clientHeight || 480;
  poseCanvas.width = width;
  poseCanvas.height = height;
}

function analyzePoseLandmarks(landmarks) {
  const angle = (a, b, c) => {
    if (!a || !b || !c) return 0;
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
    if (mag === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
  };

  const leftKnee = angle(landmarks[23], landmarks[25], landmarks[27]);
  const rightKnee = angle(landmarks[24], landmarks[26], landmarks[28]);
  const knee = (leftKnee + rightKnee) / 2 || 0;

  const leftHip = angle(landmarks[11], landmarks[23], landmarks[25]);
  const rightHip = angle(landmarks[12], landmarks[24], landmarks[26]);
  const hip = (leftHip + rightHip) / 2 || 0;

  const torsoLean = Math.abs((landmarks[11]?.x || 0) - (landmarks[12]?.x || 0));
  const stanceWidth = Math.abs((landmarks[25]?.x || 0) - (landmarks[26]?.x || 0));

  const exerciseRules = {
    squat: { down: 110, up: 150 },
    lunge: { down: 115, up: 160 },
    'knee-ext': { down: 110, up: 160 }
  };
  const rule = exerciseRules[selectedExercise] || exerciseRules.squat;

  let score = 100;
  score -= Math.max(0, Math.abs(180 - knee) * 0.3);
  score -= Math.max(0, Math.abs(90 - hip) * 0.4);
  score -= Math.max(0, torsoLean * 120);
  score -= Math.max(0, (0.18 - stanceWidth) * 80);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const quality = score;
  const form = Math.max(0, Math.min(100, score - 4));

  const feedback = [];
  if (selectedExercise === 'squat') {
    if (hip < 70) feedback.push('Rise a little higher before your next rep.');
    if (knee > 140) feedback.push('Sink deeper to engage muscles more effectively.');
  } else if (selectedExercise === 'lunge') {
    if (knee > 140) feedback.push('Bend the front knee more to reach a stronger lunge.');
    if (stanceWidth < 0.13) feedback.push('Step wider for better balance.');
  } else if (selectedExercise === 'knee-ext') {
    if (knee > 160) feedback.push('Fully extend the knee with controlled motion.');
    if (knee < 120) feedback.push('Focus on a full extension before lowering.');
  }
  if (torsoLean > 0.12) feedback.push('Keep your torso steady and upright.');
  if (feedback.length === 0) feedback.push('Good control. Keep your form steady.');

  return {
    knee: Math.round(knee),
    hip: Math.round(hip),
    quality,
    form,
    feedback: feedback.join(' '),
    poseLandmarks: landmarks,
    featureVector: {
      left_knee: leftKnee,
      right_knee: rightKnee,
      left_hip: leftHip,
      right_hip: rightHip,
      torso_lean: torsoLean,
      stance_width: stanceWidth
    },
    rule
  };
}

function updatePoseDisplay(metrics) {
  if (kneeAngle) kneeAngle.textContent = `${metrics.knee}°`;
  if (hipAngle) hipAngle.textContent = `${metrics.hip}°`;
  setQualityScore(metrics.quality);
  if (formScoreLbl) {
    formScoreLbl.textContent = `${metrics.form}%`;
    formScoreLbl.style.color = metrics.form >= 80 ? 'var(--success)' : metrics.form >= 65 ? 'var(--warning)' : 'var(--danger)';
  }
  if (formScoreBar) formScoreBar.style.width = `${metrics.form}%`;
  if (metrics.feedback) addFeedback(metrics.feedback, metrics.quality >= 75 ? 'ok' : 'warn');
}

function countRepsFromPose(metrics) {
  const now = Date.now();
  const rule = metrics.rule || { down: 110, up: 150 };
  if (repState === 'up' && metrics.knee <= rule.down) {
    repState = 'down';
  } else if (repState === 'down' && metrics.knee >= rule.up && now - lastRepTime > 800) {
    lastRepTime = now;
    repState = 'up';
    addRep();
  }
}

function onPoseResults(results) {
  if (!canvasCtx || !poseCanvas) return;
  updateCanvasSize();
  canvasCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00e5ff', lineWidth: 2 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ffffff', lineWidth: 1 });

    const metrics = analyzePoseLandmarks(results.poseLandmarks);
    updatePoseDisplay(metrics);
    countRepsFromPose(metrics);

    if (activeSessionId) {
      const now = Date.now();
      if (now - lastSaveTime > 1000) {
        const elapsed = (now - sessionStartTime) / 1000;
        saveSessionFrame(elapsed, metrics.knee, metrics.hip, metrics.quality, metrics.form, metrics.feedback);
        lastSaveTime = now;
      }
      if (now - lastInferenceTime > inferenceCooldown) {
        lastInferenceTime = now;
        classifyExercise(metrics.featureVector);
      }
    }
  }
}

async function initPosePipeline() {
  if (mpPose) return;
  // If MediaPipe isn't loaded, try to load scripts dynamically and wait
  if (typeof Pose === 'undefined' || typeof Camera === 'undefined') {
    addFeedback('MediaPipe Pose is not loaded yet. Loading...', 'info');
    try {
      await loadMediaPipeScripts();
      addFeedback('MediaPipe loaded.', 'ok');
    } catch (e) {
      console.error('Failed to load MediaPipe scripts', e);
      addFeedback('Failed to load MediaPipe Pose. Check network or CDN.', 'warn');
      return;
    }
  }

  mpPose = new Pose({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}` });
  mpPose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  mpPose.onResults(onPoseResults);

  mpCamera = new Camera(videoFeed, {
    onFrame: async () => {
      await mpPose.send({ image: videoFeed });
    },
    width: 640,
    height: 480
  });
}

async function enableCamera() {
  try {
    await initPosePipeline();
    if (mpCamera) await mpCamera.start();
    camPlaceholder.style.display = 'none';
    videoFeed.style.display = 'block';
    camBtn.textContent = '📷 Camera On';
    cameraOn = true;
    if (videoFeed.readyState >= 2) updateCanvasSize();
    videoFeed.addEventListener('loadedmetadata', updateCanvasSize, { once: true });
  } catch (err) {
    console.error(err);
    addFeedback('Could not access camera. Check browser permissions.', 'warn');
  }
}

async function disableCamera() {
  if (mpCamera) {
    await mpCamera.stop();
  }
  if (videoFeed.srcObject) {
    videoFeed.srcObject.getTracks().forEach(t => t.stop());
  }
  videoFeed.srcObject = null;
  camPlaceholder.style.display = 'flex';
  videoFeed.style.display = 'none';
  camBtn.textContent = '📷 Camera Off';
  cameraOn = false;
}

enableCamBtn?.addEventListener('click', enableCamera);
camBtn?.addEventListener('click', () => {
  if (cameraOn) {
    disableCamera();
  } else {
    enableCamera();
  }
});

const topbarSubtitle = document.getElementById('topbarSubtitle');

function updateSessionSubtitle() {
  const label = selectedExercise === 'lunge' ? 'Lunges' : selectedExercise === 'knee-ext' ? 'Knee Extensions' : 'Squats';
  if (topbarSubtitle) topbarSubtitle.textContent = `Exercise: ${label}`;
}

document.querySelectorAll('.ex-select-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.ex-select-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    selectedExercise = item.dataset.ex || 'squat';
    updateSessionSubtitle();
    resetReps();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentUser();
  updateSessionSubtitle();
});

// Prefetch MediaPipe scripts in background to speed up camera start
document.addEventListener('DOMContentLoaded', () => {
  loadMediaPipeScripts().catch(() => {/* silent */});
});

// ─── Timer ───────────────────────────────────────────────
function updateTimer() {
  timerSec++;
  const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
  const s = String(timerSec % 60).padStart(2, '0');
  if (timerEl) timerEl.textContent = `${m}:${s}`;
}

// ─── Start / pause / end ─────────────────────────────────
startBtn?.addEventListener('click', async () => {
  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  await startSession();
  sessionStartTime = Date.now();
  lastSaveTime = 0;
  repState = 'up';
  lastRepTime = 0;
  timerInterval = setInterval(updateTimer, 1000);
  if (!cameraOn) {
    sessionInterval = setInterval(simulateFrame, 800);
  }
  if (cameraOn && mpCamera) {
    await mpCamera.start();
  }
  addFeedback('Session started. Begin your exercise!', 'info');
});

pauseBtn?.addEventListener('click', async () => {
  running = !running;
  pauseBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
  if (running) {
    timerInterval = setInterval(updateTimer, 1000);
    if (!cameraOn) sessionInterval = setInterval(simulateFrame, 800);
    if (cameraOn && mpCamera) await mpCamera.start();
    addFeedback('Session resumed.', 'info');
  } else {
    clearInterval(timerInterval);
    clearInterval(sessionInterval);
    if (cameraOn && mpCamera) await mpCamera.stop();
    addFeedback('Session paused.', 'warn');
  }
});

endBtn?.addEventListener('click', async () => {
  if (!confirm('End this session and save results?')) return;
  clearInterval(timerInterval);
  clearInterval(sessionInterval);
  await endSession();
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

  if (repCount > 0 && repCount % 5 === 0) {
    requestAiAdvice();
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

  if (activeSessionId) {
    saveSessionFrame(frameCount * 0.8, knee, hip, quality, formScore, feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)].msg);
  }

  // Every ~4 frames, add rep + feedback when no camera is available
  if (frameCount % 4 === 0) {
    addRep();
    const fb = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];
    addFeedback(fb.msg, fb.type);
  }
}

async function requestAiAdvice() {
  try {
    const res = await fetch('php/ai_api.php?action=feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise: selectedExercise,
        quality: parseFloat(qualityText?.textContent || '0'),
        form: parseFloat(formScoreLbl?.textContent.replace('%', '') || '0'),
        reps: repCount
      })
    });
    const data = await res.json();
    if (data.advice) {
      addFeedback(data.advice, 'info');
    }
  } catch (err) {
    console.error('AI advice request failed', err);
  }
}

async function classifyExercise(featureVector) {
  try {
    const res = await fetch('php/infer_model.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_vector: featureVector })
    });
    const data = await res.json();
    if (data.exercise) {
      currentExercisePrediction = data.exercise;
      if (data.exercise !== selectedExercise) {
        addFeedback(`Model predicts ${data.exercise}. Keep the ${selectedExercise} position for best results.`, 'warn');
      } else {
        addFeedback(`Model confirms ${selectedExercise}. Keep going!`, 'ok');
      }
    }
  } catch (err) {
    console.error('Exercise classification failed', err);
  }
}

async function startSession() {
  if (activeSessionId) return activeSessionId;
  try {
    const res = await fetch('php/session_api.php?action=start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise: selectedExercise })
    });
    const data = await res.json();
    if (data.session_id) {
      activeSessionId = data.session_id;
      return activeSessionId;
    }
    addFeedback('Unable to create session.', 'warn');
  } catch (err) {
    console.error('Start session failed', err);
    addFeedback('Unable to start session.', 'warn');
  }
  return null;
}

async function saveSessionFrame(frameTime, knee, hip, quality, formScore, feedback) {
  if (!activeSessionId) return;
  try {
    await fetch('php/session_api.php?action=save_frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        frame_time: frameTime,
        knee_angle: knee,
        hip_angle: hip,
        quality_score: quality,
        form_score: formScore,
        feedback
      })
    });
  } catch (err) {
    console.error('Failed to save session frame', err);
  }
}

async function endSession() {
  if (!activeSessionId) {
    window.location.href = 'dashboard.html';
    return;
  }
  try {
    const res = await fetch('php/session_api.php?action=end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        total_reps: repCount,
        sets_done: setNum,
        status: 'completed'
      })
    });
    const data = await res.json();
    if (data.ok) {
      const qualityValue = parseFloat(qualityText?.textContent.replace('%', '') || '0');
      const formValue = parseFloat(formScoreLbl?.textContent.replace('%', '') || '0');
      await fetch('php/ai_api.php?action=train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          avg_quality: qualityValue,
          avg_form_score: formValue,
          total_reps: repCount,
          sets_done: setNum,
          feedback_tag: qualityValue >= 80 ? 'positive' : 'improvement',
          feedback_text: `Recorded session with quality ${qualityValue}% and ${formValue}% form.`
        })
      });
    }
  } catch (err) {
    console.error('End session failed', err);
  }
  activeSessionId = null;
  if (cameraOn) await disableCamera();
  window.location.href = 'dashboard.html';
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function loadMediaPipeScripts() {
  if (typeof Pose !== 'undefined' && typeof Camera !== 'undefined') return;
  const bases = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/',
    'https://unpkg.com/@mediapipe/'
  ];
  const files = ['pose/pose.js', 'camera_utils/camera_utils.js', 'drawing_utils/drawing_utils.js'];
  let lastError = null;

  for (const base of bases) {
    try {
      for (const file of files) {
        await loadScript(base + file);
      }
      const start = Date.now();
      while ((typeof Pose === 'undefined' || typeof Camera === 'undefined') && Date.now() - start < 8000) {
        await new Promise(r => setTimeout(r, 150));
      }
      if (typeof Pose !== 'undefined' && typeof Camera !== 'undefined') {
        return;
      }
    } catch (err) {
      lastError = err;
      console.warn('MediaPipe CDN failed:', base, err);
      continue;
    }
  }
  throw lastError || new Error('MediaPipe globals not available after load');
}
