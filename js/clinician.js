// clinician.js

// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

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
        backgroundColor: labels.map((_, idx) => `rgba(0,229,255,${0.4 + idx * 0.05})`),
        borderColor: '#00e5ff',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#8b9cbf' } },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#1e2d45' },
          ticks: { color: '#8b9cbf', callback: v => v + '%' }
        }
      }
    }
  });
}

// Patient search filter
const searchInput = document.getElementById('patientSearch');
searchInput?.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.patient-row').forEach(row => {
    const name = row.querySelector('td')?.textContent.toLowerCase() || '';
    row.style.display = name.includes(q) ? '' : 'none';
  });
});

// Adherence filter
document.getElementById('adherenceFilter')?.addEventListener('change', function () {
  const val = this.value;
  document.querySelectorAll('.patient-row').forEach(row => {
    const cells = row.querySelectorAll('td');
    const adherenceText = cells[2]?.textContent.trim();
    const pct = parseInt(adherenceText) || 100;
    if (!val) { row.style.display = ''; return; }
    row.style.display = (val === 'high' ? pct >= 70 : pct < 70) ? '' : 'none';
  });
});

// ------------------------------
// Patient detail fetch (clinician-patient.html)
// ------------------------------
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadPatientDetail() {
  const userNameEl = document.getElementById('userName');
  if (!userNameEl) return; // not on patient page

  const pid = getQueryParam('patient_id') || getQueryParam('id');
  if (!pid) {
    userNameEl.textContent = 'Unknown Patient';
    return;
  }

  try {
    const res = await fetch(`php/clinician_api.php?action=patient_detail&patient_id=${encodeURIComponent(pid)}`);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    if (data.error) {
      userNameEl.textContent = 'Patient not found';
      return;
    }

    const patient = data.patient || {};
    const sessions = data.sessions || [];
    const progress = data.progress || [];

    // Header user info
    userNameEl.textContent = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    document.getElementById('userRole') && (document.getElementById('userRole').textContent = patient.condition_type || '');

    // Stat cards - a simple mapping
    const statCards = document.querySelectorAll('.stats-row .stat-card');
    if (statCards[0]) {
      statCards[0].querySelector('.stat-card-label').textContent = 'Patient';
      statCards[0].querySelector('.stat-card-num').textContent = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
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
      statCards[2].querySelector('.stat-card-num').textContent = `${Math.min(100, avgQuality)}%`;
      const fill = statCards[2].querySelector('.mini-fill');
      if (fill) fill.style.width = `${Math.min(100, avgQuality)}%`;
    }

    if (statCards[3]) {
      statCards[3].querySelector('.stat-card-label').textContent = 'Avg Quality';
      statCards[3].querySelector('.stat-card-num').textContent = `${avgQuality}%`;
    }

    // Populate session summary text blocks if present
    const summary = document.querySelector('.patient-list-card .exercise-item');
    const container = document.querySelector('.patient-list-card');
    if (container) {
      // Remove placeholder items
      container.querySelectorAll('.exercise-item').forEach(n => n.remove());
      // Add recent sessions (up to 4)
      const recent = sessions.slice(0,4);
      for (const s of recent) {
        const div = document.createElement('div');
        div.className = 'exercise-item';
        div.innerHTML = `
          <div class="ex-icon">📌</div>
          <div class="ex-info">
            <div class="ex-name">${s.exercise || 'Exercise'}</div>
            <div class="ex-detail text-muted">${new Date(s.started_at).toLocaleString()} · ${s.total_reps || 0} reps · ${s.avg_quality || 0}%</div>
          </div>
        `;
        container.appendChild(div);
      }
    }

  } catch (err) {
    console.error('Failed to load patient detail', err);
  }
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
  loadPatientDetail();
  loadClinicianUser();
});

async function loadClinicianUser() {
  const res = await fetch('php/me.php');
  if (res.status === 401) { window.location.href = 'login.html'; return; }
  const data = await res.json();
  const user = data.user || {};

  document.getElementById('userName') && (document.getElementById('userName').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim());
  document.getElementById('userRole') && (document.getElementById('userRole').textContent = user.role || 'Clinician');

  document.getElementById('totalPatients') && (document.getElementById('totalPatients').textContent = data.patient_count || 0);
  document.getElementById('sessionsToday') && (document.getElementById('sessionsToday').textContent = data.sessions_today || 0);
  document.getElementById('avgAdherence') && (document.getElementById('avgAdherence').textContent = `${data.avg_adherence || 0}%`);
  document.getElementById('avgQuality') && (document.getElementById('avgQuality').textContent = `${data.avg_adherence || 0}%`);
  document.getElementById('adherenceBar') && (document.getElementById('adherenceBar').style.width = `${data.avg_adherence || 0}%`);
  document.getElementById('activeTodayLabel') && (document.getElementById('activeTodayLabel').textContent = `${data.sessions_today || 0} sessions started today`);
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
    if (data.error) { tbody.innerHTML = `<tr><td colspan="6">${data.error}</td></tr>`; return; }

    const patients = data.patients || [];
    tbody.innerHTML = '';
    for (const p of patients) {
      const tr = document.createElement('tr');
      tr.className = 'patient-row';
      tr.dataset.id = p.id;

      const last = p.last_session ? new Date(p.last_session).toLocaleString() : '—';
      const adherence = p.avg_quality ? Math.round(p.avg_quality) : 0;
      const quality = p.avg_quality ? Math.round(p.avg_quality) : 0;
      const status = p.total_sessions && p.total_sessions > 0 ? 'Active' : 'Resting';

      tr.innerHTML = `
        <td>
          <div class="patient-cell">
            <div class="user-avatar" style="width:30px;height:30px;font-size:.75rem;">${(p.first_name||'')[0]||'?'}</div>
            <div>
              <div style="font-size:.875rem;font-weight:600;">${p.first_name || ''} ${p.last_name || ''}</div>
              <div class="text-muted" style="font-size:.75rem;">${p.condition_type || ''}</div>
            </div>
          </div>
        </td>
        <td class="text-muted" style="font-size:.8rem;">${last}</td>
        <td>
          <div class="mini-bar" style="width:100px;"><div class="mini-fill" style="width:${adherence}%;background:${adherence>=70? 'var(--success)': (adherence>=50? 'var(--warning)': 'var(--danger)')};"></div></div>
          <span style="font-size:.8rem;">${adherence}%</span>
        </td>
        <td><span>${quality}%</span></td>
        <td><span class="badge">${status}</span></td>
        <td><a href="clinician-patient.html?id=${p.id}" class="btn btn-outline btn-sm">View</a></td>
      `;

        tbody.appendChild(tr);
    }

    renderClinicianChart(patients);

  } catch (err) {
    console.error('Failed to load patients', err);
    tbody.innerHTML = '<tr><td colspan="6">Failed to load patients</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadPatientList);