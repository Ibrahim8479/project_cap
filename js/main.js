// main.js - shared across all pages

function applyUserTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.dispatchEvent(new CustomEvent('app-theme-change', { detail: { dark: isDark } }));
}

try {
  applyUserTheme(localStorage.getItem('pref.darkMode') === '1');
} catch (err) {
  console.debug('Unable to load saved theme preference', err);
}

// Mobile nav toggle
const hamburger = document.getElementById('hamburger');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    const nav = document.querySelector('.nav-links');
    nav?.classList.toggle('open');
  });
}

// Sidebar toggle (app pages)
const sidebarToggle = document.getElementById('sidebarToggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar?.classList.toggle('open') || false;
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const sidebar = document.getElementById('sidebar');
if (sidebar && sidebarToggle) {
  document.addEventListener('click', event => {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(event.target) &&
        !sidebarToggle.contains(event.target)) {
      sidebar.classList.remove('open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
      sidebarToggle.focus();
    }
  });
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Nav highlight on scroll
const sections = document.querySelectorAll('section[id]');
if (sections.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.nav-links a').forEach(a => {
          a.classList.toggle('active-nav', a.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { threshold: 0.5 });
  sections.forEach(s => observer.observe(s));
}

// Replace broken logo images with inline SVG fallback
document.addEventListener('DOMContentLoaded', () => {
  const inlineLogo = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#a51c28" />
      <stop offset="100%" stop-color="#6d111a" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="url(#g)" />
  <path d="M20 36 L28 24 L36 32 L44 20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

  document.querySelectorAll('img.nav-logo').forEach(img => {
    // If already loaded successfully, do nothing
    if (img.complete && img.naturalWidth !== 0) return;
    img.addEventListener('error', () => {
      const wrapper = document.createElement('span');
      wrapper.className = 'nav-logo svg-fallback';
      wrapper.innerHTML = inlineLogo;
      img.replaceWith(wrapper);
    });
    // If image isn't loaded yet but failed silently, guard with timeout
    setTimeout(() => {
      if (!img.complete || img.naturalWidth === 0) {
        const wrapper = document.createElement('span');
        wrapper.className = 'nav-logo svg-fallback';
        wrapper.innerHTML = inlineLogo;
        img.replaceWith(wrapper);
      }
    }, 500);
  });
});

// Shared: load current user and update header/user-chip across pages
window.setUserProfileAvatar = function (avatar, user) {
  const initials = `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() || 'A';
  avatar.textContent = initials;
  avatar.classList.toggle('has-profile-photo', Boolean(user.profile_picture_url));
  avatar.querySelector('.profile-avatar-image')?.remove();
  if (!user.profile_picture_url) return;

  const image = document.createElement('img');
  image.className = 'profile-avatar-image';
  image.src = user.profile_picture_url;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener('error', () => {
    image.remove();
    avatar.classList.remove('has-profile-photo');
  }, { once: true });
  avatar.appendChild(image);
};

window.setUserProfileAvatars = function (user) {
  document.querySelectorAll('.user-avatar').forEach(avatar => {
    if (avatar.closest('.patient-cell') || avatar.id === 'patientProfileAvatar') return;
    window.setUserProfileAvatar(avatar, user);
  });
};

async function loadSharedCurrentUser() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) return; // not logged in
    const data = await res.json();
    if (!data || !data.user) return;
    const user = data.user;
    // set header elements
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    if (userNameEl) userNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    if (userRoleEl) {
      const extra = user.role === 'patient' && data.sessions && data.sessions.length ? ` · Day ${data.sessions.length}` : '';
      userRoleEl.textContent = (user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : '') + extra;
    }
    const reminderSettings = document.getElementById('patientReminderSettings');
    if (reminderSettings) reminderSettings.hidden = user.role !== 'patient';
    window.setUserProfileAvatars(user);

    // sync server preferences into localStorage if available
    if (data.user.preferences) {
      const prefs = data.user.preferences;
      localStorage.setItem('pref.receiveReminders', prefs.receive_reminders ? '1' : '0');
      localStorage.setItem('pref.realtimeFeedback', prefs.realtime_feedback ? '1' : '0');
      localStorage.setItem('pref.darkMode', prefs.dark_mode ? '1' : '0');
      localStorage.setItem('pref.reminderTime', prefs.reminder_time || '18:00');
      applyUserTheme(prefs.dark_mode);
      const reminderToggle = document.getElementById('prefReceiveReminders');
      const reminderTime = document.getElementById('prefReminderTime');
      const feedbackToggle = document.getElementById('prefRealtimeFeedback');
      const darkToggle = document.getElementById('prefDarkMode');
      if (reminderToggle) reminderToggle.checked = prefs.receive_reminders;
      if (reminderTime) {
        reminderTime.value = prefs.reminder_time || '18:00';
        reminderTime.disabled = !prefs.receive_reminders;
      }
      if (feedbackToggle) feedbackToggle.checked = prefs.realtime_feedback;
      if (darkToggle) darkToggle.checked = prefs.dark_mode;
    }
    maybeShowSessionReminder(data);
  } catch (err) {
    // silently ignore - shared loader shouldn't block page
    console.debug('loadSharedCurrentUser failed', err);
  }
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hasCompletedSessionToday(sessions) {
  const today = getLocalDateKey();
  return sessions.some(session => {
    if (session.status !== 'completed') return false;
    const startedAt = new Date(String(session.started_at || '').replace(' ', 'T'));
    return !Number.isNaN(startedAt.getTime()) && getLocalDateKey(startedAt) === today;
  });
}

function maybeShowSessionReminder(data) {
  const user = data.user;
  const preferences = user.preferences || {};
  if (
    user.role !== 'patient' ||
    !preferences.receive_reminders ||
    window.location.pathname.endsWith('/session.html') ||
    hasCompletedSessionToday(data.sessions || [])
  ) return;

  const reminderTime = /^\d{2}:\d{2}$/.test(preferences.reminder_time || '')
    ? preferences.reminder_time
    : '18:00';
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hours * 60 + minutes) return;

  const dateKey = getLocalDateKey(now);
  const reminderKey = `sessionReminderShown.${user.id}.${dateKey}`;
  if (localStorage.getItem(reminderKey) === '1') return;
  localStorage.setItem(reminderKey, '1');

  const notice = document.createElement('section');
  notice.className = 'session-reminder-notice';
  notice.id = 'sessionReminderNotice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const message = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Your daily movement reminder';
  const detail = document.createElement('p');
  detail.textContent = 'You have not completed a session today. Ready to work on your exercises?';
  message.append(title, detail);

  const actions = document.createElement('div');
  actions.className = 'session-reminder-actions';
  const start = document.createElement('a');
  start.className = 'btn btn-primary btn-sm';
  start.href = 'session.html';
  start.textContent = 'Start a session';
  const dismiss = document.createElement('button');
  dismiss.className = 'btn btn-ghost btn-sm';
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => notice.remove());
  actions.append(start, dismiss);
  notice.append(message, actions);
  document.body.appendChild(notice);
}

document.addEventListener('DOMContentLoaded', loadSharedCurrentUser);