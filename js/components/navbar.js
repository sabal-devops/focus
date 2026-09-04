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
    path: '/agenda',
    label: 'Agenda',
    icon: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>`
  },
  {
    path: '/finanze',
    label: 'Finanze',
    icon: `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
  },
  {
    path: '/altro',
    label: 'Altro',
    icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`
  }
];

const subPages = ['/spesa', '/dispensa', '/settings'];

export function render(container) {
  container.className = 'navbar';
  const currentHash = window.location.hash.slice(1) || '/';
  const isSubPage = subPages.includes(currentHash);

  container.innerHTML = tabs.map(tab => {
    const isActive = currentHash === tab.path || (tab.path === '/altro' && isSubPage);
    return `
      <a href="#${tab.path}" class="nav-item ${isActive ? 'active' : ''}">
        ${tab.icon}
        <span>${tab.label}</span>
      </a>
    `;
  }).join('');
}
