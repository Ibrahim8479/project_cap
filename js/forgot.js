// js/forgot.js
document.getElementById('forgotForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('forgotEmail')?.value.trim();
  const msg = document.getElementById('forgotMessage');
  if (!email) {
    msg.textContent = 'Please enter your email address.';
    msg.style.display = 'block';
    return;
  }
  msg.textContent = 'If that email exists, a reset link has been sent.';
  msg.style.display = 'block';
});
