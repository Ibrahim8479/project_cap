// auth.js

// Role toggle
const roleToggle = document.getElementById('roleToggle');
const roleInput  = document.getElementById('roleInput');

if (roleToggle) {
  roleToggle.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      roleToggle.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      if (roleInput) roleInput.value = role;

      // Toggle patient/clinician fields on register page
      const patientFields    = document.getElementById('patientFields');
      const clinicianFields  = document.getElementById('clinicianFields');
      if (patientFields)   patientFields.style.display   = role === 'patient'   ? '' : 'none';
      if (clinicianFields) clinicianFields.style.display = role === 'clinician' ? '' : 'none';
    });
  });
}

// Read role from URL params (e.g. login.html?role=clinician)
const urlRole = new URLSearchParams(window.location.search).get('role');
if (urlRole && roleToggle) {
  const btn = roleToggle.querySelector(`[data-role="${urlRole}"]`);
  if (btn) btn.click();
}

// Password toggle
const togglePwd = document.getElementById('togglePwd');
if (togglePwd) {
  togglePwd.addEventListener('click', () => {
    const pwd = document.getElementById('password');
    pwd.type = pwd.type === 'password' ? 'text' : 'password';
    togglePwd.textContent = pwd.type === 'password' ? '👁' : '🙈';
  });
}

// Login form client-side validation
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = loginForm.querySelector('[name=email]').value.trim();
    const pwd   = loginForm.querySelector('[name=password]').value;
    const role  = roleInput?.value || 'patient';
    const errEl = document.getElementById('loginError');

    if (!email || !pwd) {
      showError(errEl, 'Please fill in all fields.');
      return;
    }

    // Demo: redirect by role (replace with real PHP auth)
    // In production this submits to php/login.php
    if (role === 'clinician') {
      window.location.href = 'clinician.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  });
}

// Register form client-side validation
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', e => {
    e.preventDefault();
    const pwd1  = registerForm.querySelector('[name=password]').value;
    const pwd2  = registerForm.querySelector('[name=password_confirm]').value;
    const errEl = document.getElementById('registerError');

    if (pwd1 !== pwd2) {
      showError(errEl, 'Passwords do not match.');
      return;
    }
    if (pwd1.length < 8) {
      showError(errEl, 'Password must be at least 8 characters.');
      return;
    }

    // Demo redirect (replace with real PHP form submit)
    const role = roleInput?.value || 'patient';
    window.location.href = role === 'clinician' ? 'clinician.html' : 'dashboard.html';
  });
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}