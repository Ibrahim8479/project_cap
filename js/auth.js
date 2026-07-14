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
    const email = loginForm.querySelector('[name=email]').value.trim();
    const pwd   = loginForm.querySelector('[name=password]').value;
    const errEl = document.getElementById('loginError');

    if (!email || !pwd) {
      e.preventDefault();
      showError(errEl, 'Please fill in all fields.');
      return;
    }

    // allow normal form submission to PHP backend
  });
}

// Register form client-side validation
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', e => {
    const pwd1  = registerForm.querySelector('[name=password]').value;
    const pwd2  = registerForm.querySelector('[name=password_confirm]').value;
    const errEl = document.getElementById('registerError');

    if (pwd1 !== pwd2) {
      e.preventDefault();
      showError(errEl, 'Passwords do not match.');
      return;
    }
    if (pwd1.length < 8) {
      e.preventDefault();
      showError(errEl, 'Password must be at least 8 characters.');
      return;
    }

    // allow normal form submission to PHP backend
  });
}

function readErrorFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (!error) return;
  const loginErrEl = document.getElementById('loginError');
  const registerErrEl = document.getElementById('registerError');
  const messages = {
    missing_fields: 'Please fill in all required fields.',
    invalid_email: 'Please enter a valid email address.',
    invalid_credentials: 'Invalid email or password.',
    wrong_role: 'Please select the correct role.',
    email_taken: 'This email is already registered.',
  };
  const msg = messages[error] || decodeURIComponent(error.replace(/\+/g, ' ').replace(/_/g, ' '));
  if (loginErrEl && window.location.pathname.endsWith('login.html')) {
    showError(loginErrEl, msg);
  }
  if (registerErrEl && window.location.pathname.endsWith('register.html')) {
    showError(registerErrEl, msg);
  }
}

readErrorFromQuery();

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}