// clinician.js

// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// Weekly overview chart
const ctx = document.getElementById('clinicianChart')?.getContext('2d');
if (ctx) {
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Sessions',
          data: [4, 6, 5, 8, 7, 3, 2],
          backgroundColor: 'rgba(0,229,255,0.25)',
          borderColor: '#00e5ff',
          borderWidth: 1,
        },
        {
          label: 'Avg Quality',
          data: [76, 79, 77, 83, 81, 75, 72],
          type: 'line',
          borderColor: '#7c3aed',
          backgroundColor: 'transparent',
          tension: 0.4,
          yAxisID: 'y2',
          pointBackgroundColor: '#7c3aed',
          pointRadius: 3,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x:  { grid: { color: '#1e2d45' }, ticks: { color: '#8b9cbf' } },
        y:  { grid: { color: '#1e2d45' }, ticks: { color: '#8b9cbf' }, beginAtZero: true },
        y2: { position: 'right', grid: { display: false }, ticks: { color: '#8b9cbf', callback: v => v + '%' }, min: 60, max: 100 }
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