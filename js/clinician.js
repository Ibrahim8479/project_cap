// clinician.js

// Weekly overview chart
const clinicianChartCtx = document.getElementById('clinicianChart')?.getContext('2d');
let clinicianChartInstance = null;

function renderClinicianChart(patients = []) {
  if (!clinicianChartCtx) return;
  const labels = patients.slice(0, 7).map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient');
  const values = patients.slice(0, 7).map(p => Math.round(p.avg_quality || 0));

  if (clinicianChartInstance) clinicianChartInstance.destroy();
  clinicianChartInstance = new Chart(clinicianChartCtx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        label: 'Avg Quality',
        data: values.length ? values : [0],
        backgroundColor: labels.map((_, idx) => `rgba(196,61,80,${0.4 + idx * 0.05})`),
        borderColor: '#c43d50',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0d7da' }, ticks: { color: '#725b62' } },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#f0d7da' },
          ticks: { color: '#725b62', callback: v => v + '%' }
        }
      }
    }
  });
}

// Patient search filter
const searchInput = document.getElementById('patientSearch');
function applyPatientFilters() {
  const query = (searchInput?.value || '').trim().toLowerCase();
  const adherenceFilter = document.getElementById('adherenceFilter')?.value || '';
  document.querySelectorAll('.patient-row').forEach(row => {
    const name = row.querySelector('td')?.textContent.toLowerCase() || '';
    const adherenceText = row.querySelectorAll('td')[2]?.textContent || '';
    const adherence = Number.parseInt(adherenceText, 10);
    const matchesName = name.includes(query);
    const matchesAdherence = !adherenceFilter ||
      (adherenceFilter === 'high' ? adherence >= 70 : adherence < 70);
    row.style.display = matchesName && matchesAdherence ? '' : 'none';
  });
}
searchInput?.addEventListener('input', applyPatientFilters);

// Adherence filter
document.getElementById('adherenceFilter')?.addEventListener('change', applyPatientFilters);

// ------------------------------
// Patient detail fetch (clinician-patient.html)
// ------------------------------
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadPatientDetail() {
  if (!window.location.pathname.endsWith('clinician-patient.html')) return;

  const pid = getQueryParam('patient_id') || getQueryParam('id');
  const container = document.getElementById('patientSessionList');
  if (!pid) {
    if (container) {
      container.replaceChildren();
      const message = document.createElement('p');
      message.className = 'text-muted';
      message.textContent = 'Choose a patient from the patient list to view their sessions and progress.';
      const link = document.createElement('a');
      link.href = 'clinician-patients.html';
      link.textContent = 'Open patient list';
      container.append(message, link);
    }
    return;
  }

  try {
    const res = await fetch(`php/clinician_api.php?action=patient_detail&patient_id=${encodeURIComponent(pid)}`);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (!res.ok || data.error) {
      if (container) container.textContent = data.error || 'Could not load this patient.';
      return;
    }

    const patient = data.patient || {};
    const sessions = data.sessions || [];
    const progress = data.progress || [];
    const adherenceDays = Number(data.adherence_days || 0);

    // Stat cards - a simple mapping
    const statCards = document.querySelectorAll('.stats-row .stat-card');
    if (statCards[0]) {
      statCards[0].querySelector('.stat-card-label').textContent = 'Patient';
      statCards[0].querySelector('.stat-card-num').textContent = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
      statCards[0].querySelector('.text-muted').textContent = patient.condition_type || 'No condition recorded';
    }

    if (statCards[1]) {
      statCards[1].querySelector('.stat-card-label').textContent = 'Current Activity';
      const current = sessions[0] ? sessions[0].exercise : '—';
      statCards[1].querySelector('.stat-card-num').textContent = current;
      statCards[1].querySelector('.text-muted').textContent = sessions[0] ? `${sessions[0].sets_done || 0} sets · ${sessions[0].total_reps || 0} reps` : '';
    }

    // Compute adherence & avg quality from progress
    let avgQuality = 0, total = 0;
    for (const p of progress) { avgQuality += (p.avg_quality || 0); total++; }
    avgQuality = total ? Math.round(avgQuality / total) : (sessions[0]?.avg_quality || 0);

    if (statCards[2]) {
      statCards[2].querySelector('.stat-card-label').textContent = 'Adherence';
      const adherence = Math.round(Math.min(100, adherenceDays / 7 * 100));
      statCards[2].querySelector('.stat-card-num').textContent = `${adherence}%`;
      const fill = statCards[2].querySelector('.mini-fill');
      if (fill) fill.style.width = `${adherence}%`;
    }

    if (statCards[3]) {
      statCards[3].querySelector('.stat-card-label').textContent = 'Avg Quality';
      statCards[3].querySelector('.stat-card-num').textContent = `${avgQuality}%`;
    }

    // Populate session summary text blocks if present
    if (container) {
      container.replaceChildren();
      // Add recent sessions (up to 4)
      const recent = sessions.slice(0,4);
      for (const s of recent) {
        const div = document.createElement('div');
        div.className = 'exercise-item';
        const icon = document.createElement('div');
        icon.className = 'ex-icon';
        icon.textContent = '📌';
        const info = document.createElement('div');
        info.className = 'ex-info';
        const name = document.createElement('div');
        name.className = 'ex-name';
        name.textContent = s.exercise || 'Exercise';
        const detail = document.createElement('div');
        detail.className = 'ex-detail text-muted';
        detail.textContent = `${new Date(s.started_at).toLocaleString()} · ${s.total_reps || 0} reps · ${s.avg_quality || 0}%`;
        info.append(name, detail);
        div.append(icon, info);
        container.appendChild(div);
      }
      if (!recent.length) {
        const empty = document.createElement('p');
        empty.className = 'text-muted';
        empty.textContent = 'No sessions have been recorded for this patient yet.';
        container.appendChild(empty);
      }
    }
    renderPatientProgress(progress);

  } catch (err) {
    console.error('Failed to load patient detail', err);
  }
}

function renderPatientProgress(progress) {
  if (!clinicianChartCtx) return;
  if (clinicianChartInstance) clinicianChartInstance.destroy();
  clinicianChartInstance = new Chart(clinicianChartCtx, {
    type: 'line',
    data: {
      labels: progress.map(item => item.snap_date),
      datasets: [{
        label: 'Movement Quality',
        data: progress.map(item => Math.round(item.avg_quality || 0)),
        borderColor: '#c43d50',
        backgroundColor: 'rgba(196,61,80,0.08)',
        pointBackgroundColor: '#c43d50',
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0d7da' }, ticks: { color: '#725b62' } },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#f0d7da' },
          ticks: { color: '#725b62', callback: value => `${value}%` }
        }
      }
    }
  });
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
  loadPatientDetail();
  loadClinicianUser();
});

async function loadClinicianUser() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Could not load clinician profile.');
    const user = data.user || {};
    if (user.role !== 'clinician') {
      window.location.replace('dashboard.html');
      return;
    }

    document.getElementById('userName') && (document.getElementById('userName').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim());
    document.getElementById('userRole') && (document.getElementById('userRole').textContent = user.role === 'clinician' ? 'Physiotherapist' : 'Clinician');
    document.getElementById('userAvatar') && (document.getElementById('userAvatar').textContent = `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase());
    const clinicianCode = document.getElementById('clinicianCode');
    if (clinicianCode) clinicianCode.textContent = user.clinician_code || 'Contact support to set up your code';
    document.getElementById('totalPatients') && (document.getElementById('totalPatients').textContent = data.patient_count || 0);
    document.getElementById('sessionsToday') && (document.getElementById('sessionsToday').textContent = data.sessions_today || 0);
    document.getElementById('avgAdherence') && (document.getElementById('avgAdherence').textContent = `${data.avg_adherence || 0}%`);
    document.getElementById('avgQuality') && (document.getElementById('avgQuality').textContent = `${data.avg_quality || 0}%`);
    document.getElementById('adherenceBar') && (document.getElementById('adherenceBar').style.width = `${data.avg_adherence || 0}%`);
    document.getElementById('activeTodayLabel') && (document.getElementById('activeTodayLabel').textContent = `${data.sessions_today || 0} sessions started today`);
  } catch (err) {
    console.error('Failed to load clinician profile', err);
    const rows = document.getElementById('patientTableBody') || document.getElementById('patientTbody');
    if (rows && !rows.children.length) rows.textContent = 'Could not load clinician data. Please refresh the page.';
  }
}

// ------------------------------
// Load patient list for clinician-patients.html
// ------------------------------
async function loadPatientList() {
  const tbody = document.getElementById('patientTbody') || document.getElementById('patientTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('php/clinician_api.php?action=list_patients');
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Could not load patients.');

    const patients = data.patients || [];
    tbody.replaceChildren();
    for (const p of patients) {
      const tr = document.createElement('tr');
      tr.className = 'patient-row';
      tr.dataset.id = p.id;

      const last = p.last_session ? new Date(p.last_session).toLocaleString() : '—';
      const adherence = Math.round(Math.min(100, Number(p.active_days || 0) / 7 * 100));
      const quality = Math.round(p.avg_quality || 0);
      const status = Number(p.active_sessions || 0) > 0 ? 'In session' : 'Resting';

      const patientCell = document.createElement('td');
      const patientInfo = document.createElement('div');
      patientInfo.className = 'patient-cell';
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.style.cssText = 'width:30px;height:30px;font-size:.75rem;';
      avatar.textContent = (p.first_name || '?').charAt(0).toUpperCase();
      const nameInfo = document.createElement('div');
      const name = document.createElement('div');
      name.style.cssText = 'font-size:.875rem;font-weight:600;';
      name.textContent = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      const condition = document.createElement('div');
      condition.className = 'text-muted';
      condition.style.fontSize = '.75rem';
      condition.textContent = p.condition_type || '';
      nameInfo.append(name, condition);
      patientInfo.append(avatar, nameInfo);
      patientCell.appendChild(patientInfo);

      const lastCell = document.createElement('td');
      lastCell.className = 'text-muted';
      lastCell.style.cssText = 'font-size:.8rem;';
      lastCell.textContent = last;
      const adherenceCell = document.createElement('td');
      const bar = document.createElement('div');
      bar.className = 'mini-bar';
      bar.style.width = '100px';
      const fill = document.createElement('div');
      fill.className = 'mini-fill';
      fill.style.width = `${adherence}%`;
      fill.style.background = adherence >= 70 ? 'var(--success)' : adherence >= 50 ? 'var(--warning)' : 'var(--danger)';
      bar.appendChild(fill);
      const adherenceLabel = document.createElement('span');
      adherenceLabel.style.fontSize = '.8rem';
      adherenceLabel.textContent = `${adherence}%`;
      adherenceCell.append(bar, adherenceLabel);
      const qualityCell = document.createElement('td');
      qualityCell.textContent = `${quality}%`;
      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = status === 'In session' ? 'badge badge-success' : 'badge badge-teal';
      statusBadge.textContent = status;
      statusCell.appendChild(statusBadge);
      const viewCell = document.createElement('td');
      const viewLink = document.createElement('a');
      viewLink.href = `clinician-patient.html?id=${encodeURIComponent(p.id)}`;
      viewLink.className = 'btn btn-outline btn-sm';
      viewLink.textContent = 'View';
      viewCell.appendChild(viewLink);
      tr.append(patientCell, lastCell, adherenceCell, qualityCell, statusCell, viewCell);
      tbody.appendChild(tr);
    }

    if (!patients.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No patients are assigned to your account.';
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    applyPatientFilters();
    renderClinicianChart(patients);
    renderClinicianPanels(patients);

  } catch (err) {
    console.error('Failed to load patients', err);
    tbody.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'Failed to load patients. Please refresh the page.';
    row.appendChild(cell);
    tbody.appendChild(row);
  }
}

function renderClinicianPanels(patients) {
  const attentionList = document.getElementById('attentionList');
  const liveSessionsList = document.getElementById('liveSessionsList');
  if (attentionList) {
    attentionList.replaceChildren();
    const attentionPatients = patients.filter(patient => Number(patient.sessions_done || 0) > 0 && Number(patient.avg_quality || 0) < 70);
    if (!attentionPatients.length) {
      attentionList.textContent = 'No patients currently need attention.';
    } else {
      for (const patient of attentionPatients) {
        const item = document.createElement('div');
        item.className = 'alert-item alert-warning';
        item.textContent = `${patient.first_name} ${patient.last_name}: movement quality below 70%.`;
        attentionList.appendChild(item);
      }
    }
  }
  if (liveSessionsList) {
    liveSessionsList.replaceChildren();
    const activePatients = patients.filter(patient => Number(patient.active_sessions || 0) > 0);
    if (!activePatients.length) {
      liveSessionsList.textContent = 'No sessions are in progress.';
    } else {
      for (const patient of activePatients) {
        const item = document.createElement('div');
        item.className = 'live-session-item';
        item.textContent = `${patient.first_name} ${patient.last_name}`;
        liveSessionsList.appendChild(item);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', loadPatientList);