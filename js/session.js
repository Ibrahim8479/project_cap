// session.js - Live session logic

// ─── State ───────────────────────────────────────────────
let running  = false;
let repCount = 0;
let totalRepCount = 0;
let setNum   = 1;
let completedSets = 0;
let timerSec = 0;
let timerInterval = null;
const EXERCISE_GOALS = {
  squat: { reps: 15, sets: 3 },
  lunge: { reps: 12, sets: 3 },
  'knee-ext': { reps: 20, sets: 2 }
};
let repTarget = EXERCISE_GOALS.squat.reps;
let setTarget = EXERCISE_GOALS.squat.sets;

// ─── DOM refs ────────────────────────────────────────────
const startBtn    = document.getElementById('startBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const endBtn      = document.getElementById('endBtn');
const repCountEl  = document.getElementById('repCount');
const repTargetEl = document.getElementById('repTarget');
const setNumEl    = document.getElementById('setNum');
const setTargetEl = document.getElementById('setTarget');
const repBarEl    = document.getElementById('repBar');
const timerEl     = document.getElementById('sessionTimer');
const kneeAngle   = document.getElementById('kneeAngle');
const hipAngle    = document.getElementById('hipAngle');
const jointLabels = document.querySelectorAll('.joint-label');
const formScoreLbl= document.getElementById('formScoreLabel');
const formScoreBar= document.getElementById('formScoreBar');
const qualityArc  = document.getElementById('qualityArc');
const qualityText = document.getElementById('qualityText');
const qualityLabel= document.getElementById('qualityLabel');
const feedbackBody= document.getElementById('feedbackBody');
const rhythmBars  = document.getElementById('rhythmBars');
const rhythmEmpty = document.getElementById('rhythmEmpty');


// ─── Camera ──────────────────────────────────────────────
const enableCamBtn   = document.getElementById('enableCam');
const camPlaceholder = document.getElementById('camPlaceholder');
const videoFeed      = document.getElementById('videoFeed');
const camBtn         = document.getElementById('camBtn');
const sessionStatus  = document.getElementById('sessionStatus');
const trackingStatus = document.getElementById('trackingStatus');
const poseCanvas     = document.getElementById('poseCanvas');
const canvasCtx      = poseCanvas?.getContext('2d');
let mpPose = null;
let mpCamera = null;
let cameraOn = false;
let activeSessionId = null;
let selectedExercise = 'squat';
let sessionStartTime = 0;
let lastSaveTime = 0;
let lastInferenceTime = 0;
let inferenceCooldown = 5000;
let aiWarningShown = false;
let repState = 'up';
let lastRepTime = 0;
let pendingFrameSaves = new Set();
let frameSaveFailures = 0;
let frameSaveWarningShown = false;

function setPageUserHeader(user) {
  if (!user) return;
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  if (userNameEl) userNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (userRoleEl) userRoleEl.textContent = user.role || '';
  if (typeof window.setUserProfileAvatars === 'function') window.setUserProfileAvatars(user);
}

async function loadCurrentUser() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (data && data.user) {
      if (data.user.role !== 'patient') {
        window.location.replace('clinician.html');
        return;
      }
      setPageUserHeader(data.user);
      const prefs = data.user.preferences;
      if (prefs) {
        localStorage.setItem('pref.realtimeFeedback', prefs.realtime_feedback ? '1' : '0');
      }
    }
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
  if (metrics.feedback) addFeedback(metrics.feedback, metrics.quality >= 75 ? 'ok' : 'warn', true);
}

function updateMovementRhythm(kneeAngleValue) {
  if (!rhythmBars || !Number.isFinite(kneeAngleValue) || kneeAngleValue <= 0) return;
  const angle = Math.max(0, Math.min(180, kneeAngleValue));
  const bar = document.createElement('div');
  bar.className = 'rhythm-bar';
  bar.style.height = `${Math.max(4, Math.round((angle / 180) * 48))}px`;
  rhythmBars.appendChild(bar);
  while (rhythmBars.children.length > 40) rhythmBars.firstElementChild.remove();
  if (rhythmEmpty) rhythmEmpty.hidden = true;
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
    jointLabels.forEach(label => { label.hidden = false; });
    window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#c43d50', lineWidth: 2 });
    window.drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ffffff', lineWidth: 1 });

    const metrics = analyzePoseLandmarks(results.poseLandmarks);
    updatePoseDisplay(metrics);
    updateMovementRhythm(metrics.knee);
    if (running) countRepsFromPose(metrics);

    if (running && activeSessionId) {
      const now = Date.now();
      if (now - lastInferenceTime > inferenceCooldown) {
        lastInferenceTime = now;
        classifyExercise(metrics.featureVector);
      }
      if (now - lastSaveTime > 1000) {
        const elapsed = (now - sessionStartTime) / 1000;
        saveSessionFrame(elapsed, metrics.knee, metrics.hip, metrics.quality, metrics.form, metrics.feedback);
        lastSaveTime = now;
      }
    }
  } else {
    jointLabels.forEach(label => { label.hidden = true; });
  }
}

async function initPosePipeline() {
  if (mpPose) return;
  // If MediaPipe isn't loaded, try to load scripts dynamically and wait
  if (typeof window.Pose === 'undefined' || typeof window.Camera === 'undefined') {
    addFeedback('MediaPipe Pose is not loaded yet. Loading...', 'info');
    await loadMediaPipeScripts();
    addFeedback('MediaPipe loaded.', 'ok');
  }

  mpPose = new window.Pose({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}` });
  mpPose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  mpPose.onResults(onPoseResults);

  mpCamera = new window.Camera(videoFeed, {
    onFrame: async () => {
      await mpPose.send({ image: videoFeed });
    },
    width: 640,
    height: 480
  });
}

async function enableCamera() {
  if (!videoFeed || !camPlaceholder || !camBtn) return;
  if (enableCamBtn) enableCamBtn.disabled = true;
  camBtn.disabled = true;
  try {
    await initPosePipeline();
    if (mpCamera) await mpCamera.start();
    camPlaceholder.style.display = 'none';
    videoFeed.style.display = 'block';
    camBtn.textContent = '📷 Camera On';
    cameraOn = true;
    if (sessionStatus) {
      sessionStatus.textContent = 'Camera ready';
      sessionStatus.className = 'badge badge-success';
    }
    if (trackingStatus) {
      trackingStatus.textContent = 'Camera connected';
      trackingStatus.className = 'badge badge-success';
    }
    if (videoFeed.readyState >= 2) updateCanvasSize();
    videoFeed.addEventListener('loadedmetadata', updateCanvasSize, { once: true });
  } catch (err) {
    console.error(err);
    const message = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
      : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
        ? 'No camera was found. Connect a camera and try again.'
        : `Camera setup failed: ${err.message || 'Check your camera and network connection.'}`;
    addFeedback(message, 'warn');
    if (sessionStatus) {
      sessionStatus.textContent = 'Camera unavailable';
      sessionStatus.className = 'badge badge-danger';
    }
  } finally {
    if (enableCamBtn) enableCamBtn.disabled = cameraOn;
    camBtn.disabled = false;
  }
}

async function disableCamera() {
  try {
    if (mpCamera) await mpCamera.stop();
  } catch (err) {
    console.error('Unable to stop camera tracking cleanly', err);
    addFeedback('Camera tracking did not stop cleanly. The browser camera stream was closed where possible.', 'warn');
  } finally {
    if (videoFeed?.srcObject) {
      videoFeed.srcObject.getTracks().forEach(track => track.stop());
    }
    if (videoFeed) videoFeed.srcObject = null;
    if (camPlaceholder) camPlaceholder.style.display = 'flex';
    if (videoFeed) videoFeed.style.display = 'none';
    jointLabels.forEach(label => { label.hidden = true; });
    if (camBtn) camBtn.textContent = '📷 Camera Off';
    cameraOn = false;
    if (enableCamBtn) enableCamBtn.disabled = false;
    if (sessionStatus) {
      sessionStatus.textContent = 'Camera needed';
      sessionStatus.className = 'badge badge-warning';
    }
    if (trackingStatus) {
      trackingStatus.textContent = 'Camera not connected';
      trackingStatus.className = 'badge badge-warning';
    }
  }
}

enableCamBtn?.addEventListener('click', enableCamera);
camBtn?.addEventListener('click', () => {
  if (running) {
    addFeedback('Pause the session before turning off the camera.', 'warn');
    return;
  }
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
    if (activeSessionId) {
      addFeedback('End the current session before changing exercises.', 'warn');
      return;
    }
    document.querySelectorAll('.ex-select-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    selectedExercise = item.dataset.ex || 'squat';
    const goal = EXERCISE_GOALS[selectedExercise] || EXERCISE_GOALS.squat;
    repTarget = goal.reps;
    setTarget = goal.sets;
    if (repTargetEl) repTargetEl.textContent = repTarget;
    if (setTargetEl) setTargetEl.textContent = setTarget;
    updateSessionSubtitle();
    resetReps();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentUser();
  updateSessionSubtitle();
});

// ─── Timer ───────────────────────────────────────────────
function updateTimer() {
  timerSec++;
  const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
  const s = String(timerSec % 60).padStart(2, '0');
  if (timerEl) timerEl.textContent = `${m}:${s}`;
}

// ─── Start / pause / end ─────────────────────────────────
// A saved session must come from an active camera and pose-tracking pipeline.
startBtn?.addEventListener('click', async () => {
  if (!cameraOn) {
    addFeedback('Enable your camera before starting a monitored session.', 'warn');
    enableCamBtn?.focus();
    return;
  }
  startBtn.disabled = true;
  const sessionId = await startSession();
  if (!sessionId) {
    startBtn.disabled = false;
    return;
  }
  running = true;
  pauseBtn.disabled = false;
  sessionStartTime = Date.now();
  lastSaveTime = 0;
  repState = 'up';
  lastRepTime = 0;
  totalRepCount = 0;
  completedSets = 0;
  pendingFrameSaves.clear();
  frameSaveFailures = 0;
  frameSaveWarningShown = false;
  resetReps();
  timerInterval = setInterval(updateTimer, 1000);
  if (sessionStatus) {
    sessionStatus.textContent = 'Session in progress';
    sessionStatus.className = 'badge badge-success';
  }
  if (trackingStatus) trackingStatus.textContent = 'Tracking lower-body movement';
  addFeedback('Session started. Begin your exercise!', 'info');
});

pauseBtn?.addEventListener('click', async () => {
  if (!running && !cameraOn) {
    addFeedback('Reconnect your camera before resuming this session.', 'warn');
    return;
  }
  running = !running;
  pauseBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
  if (running) {
    timerInterval = setInterval(updateTimer, 1000);
    if (cameraOn && mpCamera) {
      try {
        await mpCamera.start();
      } catch (err) {
        running = false;
        clearInterval(timerInterval);
        pauseBtn.textContent = '▶ Resume';
        addFeedback('Could not resume camera tracking. Check camera permissions.', 'warn');
        return;
      }
    }
    if (sessionStatus) {
      sessionStatus.textContent = 'Session in progress';
      sessionStatus.className = 'badge badge-success';
    }
    addFeedback('Session resumed.', 'info');
  } else {
    clearInterval(timerInterval);
    if (cameraOn && mpCamera) {
      try {
        await mpCamera.stop();
      } catch (err) {
        console.error('Unable to pause camera tracking', err);
        addFeedback('The camera could not be paused cleanly. You can try resuming or turn the camera off.', 'warn');
      }
    }
    if (sessionStatus) {
      sessionStatus.textContent = 'Session paused';
      sessionStatus.className = 'badge badge-warning';
    }
    addFeedback('Session paused.', 'warn');
  }
});

endBtn?.addEventListener('click', async () => {
  if (!activeSessionId) {
    addFeedback('Start a session before ending it.', 'warn');
    return;
  }
  if (!confirm('End this session and save results?')) return;
  running = false;
  clearInterval(timerInterval);
  pauseBtn.textContent = '▶ Resume';
  pauseBtn.disabled = true;
  endBtn.disabled = true;
  await endSession();
  if (activeSessionId) {
    pauseBtn.disabled = false;
    endBtn.disabled = false;
  }
});

// ─── Rep counting ────────────────────────────────────────
function addRep() {
  if (completedSets >= setTarget) return;
  repCount++;
  totalRepCount++;
  if (repCountEl) repCountEl.textContent = repCount;
  const pct = Math.min((repCount / repTarget) * 100, 100);
  if (repBarEl) repBarEl.style.width = pct + '%';

  if (repCount >= repTarget) {
    completedSets++;
    if (completedSets >= setTarget) {
      addFeedback('All sets complete! Great work!', 'ok');
      setNum = setTarget;
      if (setNumEl) setNumEl.textContent = setNum;
    } else {
      setNum = completedSets + 1;
      addFeedback(`Set ${completedSets} complete! Starting set ${setNum}…`, 'ok');
      resetReps(false);
      if (setNumEl) setNumEl.textContent = setNum;
    }
  }

  if (repCount > 0 && repCount % 5 === 0) {
    requestAiAdvice();
  }
}

function resetReps(resetSet = true) {
  if (resetSet) {
    repCount = 0;
    totalRepCount = 0;
    completedSets = 0;
    setNum = 1;
  } else {
    repCount = 0;
  }
  if (repCountEl) repCountEl.textContent = '0';
  if (repBarEl)   repBarEl.style.width = '0%';
  if (setNumEl) setNumEl.textContent = setNum;
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
    if (res.ok && data.session_id) {
      activeSessionId = data.session_id;
      return activeSessionId;
    }
    addFeedback(data.error || 'Unable to create session.', 'warn');
  } catch (err) {
    console.error('Start session failed', err);
    addFeedback('Unable to start session.', 'warn');
  }
  return null;
}

async function requestAiAdvice() {
  try {
    const res = await fetch('php/ai_api.php?action=feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise: selectedExercise,
        quality: Number.parseFloat(qualityText?.textContent || '0'),
        form: Number.parseFloat(formScoreLbl?.textContent.replace('%', '') || '0'),
        reps: repCount
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Feedback is unavailable.');
    if (data.advice) addFeedback(data.advice, 'info', true);
  } catch (err) {
    console.error('AI feedback request failed', err);
    if (!aiWarningShown) {
      aiWarningShown = true;
      addFeedback('Live AI feedback is temporarily unavailable. Camera tracking will continue.', 'warn');
    }
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
    if (!res.ok || data.error) throw new Error(data.error || 'Exercise recognition is unavailable.');
    if (!data.exercise) throw new Error('Exercise recognition returned no result.');
    if (data.exercise !== selectedExercise) {
      addFeedback(`Movement analysis detected ${data.exercise}. Check that the selected exercise matches your movement.`, 'warn', true);
    }
  } catch (err) {
    console.error('Exercise recognition failed', err);
    if (!aiWarningShown) {
      aiWarningShown = true;
      addFeedback('AI exercise recognition is temporarily unavailable. Repetition tracking will continue.', 'warn');
    }
  }
}

async function saveSessionFrame(frameTime, knee, hip, quality, formScore, feedback) {
  if (!activeSessionId) return;
  // Keep outstanding requests so ending a session cannot overtake its last frame.
  const request = fetch('php/session_api.php?action=save_frame', {
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
    }).then(async res => {
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Movement data could not be saved.');
    }).catch(err => {
      frameSaveFailures++;
      console.error('Failed to save session frame', err);
      if (!frameSaveWarningShown) {
        frameSaveWarningShown = true;
        addFeedback('Some movement data could not be saved. Check your connection before ending the session.', 'warn');
      }
    });
  pendingFrameSaves.add(request);
  await request;
  pendingFrameSaves.delete(request);
}

async function endSession() {
  if (!activeSessionId) {
    addFeedback('No active session to save.', 'warn');
    return false;
  }
  try {
    const status = completedSets >= setTarget ? 'completed' : 'partial';
    await Promise.all([...pendingFrameSaves]);
    if (frameSaveFailures > 0) {
      addFeedback(`${frameSaveFailures} movement sample(s) were not saved. The session summary will include available data only.`, 'warn');
    }
    const res = await fetch('php/session_api.php?action=end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        total_reps: totalRepCount,
        sets_done: completedSets,
        status
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Unable to save session.');
    }
    if (sessionStatus) {
      sessionStatus.textContent = 'Session saved';
      sessionStatus.className = 'badge badge-success';
    }
    activeSessionId = null;
    if (cameraOn) await disableCamera();
    window.location.href = 'dashboard.html';
    return true;
  } catch (err) {
    console.error('End session failed', err);
    addFeedback(err.message || 'Unable to save session. Please try again.', 'warn');
    if (sessionStatus) {
      sessionStatus.textContent = 'Save failed';
      sessionStatus.className = 'badge badge-danger';
    }
    return false;
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

function addFeedback(msg, type = 'info', isPrompt = false) {
  if (isPrompt && localStorage.getItem('pref.realtimeFeedback') === '0') return;
  if (!feedbackBody) return;
  const icons = { ok: '✓', warn: '⚠', info: 'ℹ' };
  const div = document.createElement('div');
  div.className = `feedback-msg ${type}`;
  const icon = document.createElement('span');
  icon.className = 'feedback-icon';
  icon.textContent = icons[type] || 'ℹ';
  div.append(icon, document.createTextNode(` ${msg}`));
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
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function loadMediaPipeScripts() {
  if (typeof window.Pose !== 'undefined' && typeof window.Camera !== 'undefined') return;
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
      while ((typeof window.Pose === 'undefined' || typeof window.Camera === 'undefined') && Date.now() - start < 8000) {
        await new Promise(r => setTimeout(r, 150));
      }
      if (typeof window.Pose !== 'undefined' && typeof window.Camera !== 'undefined') {
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
