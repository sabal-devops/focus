const tabs = [
  {
    path: '/',
    label: 'Home',
    icon: `<svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`
  },
  {
    path: '/chat',
    label: 'Chat',
    icon: `<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`
  },
  {
    path: '/spesa',
    label: 'Spesa',
    icon: `<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`
  },
  {
    path: '/finanze',
    label: 'Finanze',
    icon: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
  },
  {
    path: '/dispensa',
    label: 'Dispensa',
    icon: `<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>`
  }
];

export function render(container) {
  container.className = 'navbar';
  const currentHash = window.location.hash.slice(1) || '/';
  container.innerHTML = tabs.map(tab => `
    <a href="#${tab.path}" class="nav-item ${currentHash === tab.path ? 'active' : ''}">
      ${tab.icon}
      <span>${tab.label}</span>
    </a>
  `).join('');
}
