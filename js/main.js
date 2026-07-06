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