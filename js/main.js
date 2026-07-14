// main.js - shared across all pages

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
    document.getElementById('sidebar')?.classList.toggle('open');
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
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#7c3aed" />
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