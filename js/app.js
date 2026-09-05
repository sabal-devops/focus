import { open } from './db.js';
import { register, init as initRouter } from './router.js';
import { render as renderNavbar } from './components/navbar.js';

const V = '?v=14';

function initTheme() {
  try {
    const saved = localStorage.getItem('focus_theme');
    if (saved && saved !== 'auto') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {}
}

async function boot() {
  initTheme();
  await open();

  const { render: homeView } = await import('./views/home.js' + V);
  const { render: chatView, destroy: chatDestroy } = await import('./views/chat.js' + V);
  const { render: agendaView, destroy: agendaDestroy } = await import('./views/agenda.js' + V);
  const { render: spesaView, destroy: spesaDestroy } = await import('./views/spesa.js' + V);
  const { render: finanzeView, destroy: finanzeDestroy } = await import('./views/finanze.js' + V);
  const { render: settingsView } = await import('./views/settings.js' + V);

  register('/', (c) => { homeView(c); });
  register('/chat', (c) => { chatView(c); return { destroy: chatDestroy }; });
  register('/agenda', (c) => { agendaView(c); return { destroy: agendaDestroy }; });
  register('/spesa', (c) => { spesaView(c); return { destroy: spesaDestroy }; });
  register('/dispensa', (c) => { spesaView(c); return { destroy: spesaDestroy }; });
  register('/finanze', (c) => { finanzeView(c); return { destroy: finanzeDestroy }; });
  register('/settings', (c) => { settingsView(c); });

  // Redirect /altro to /spesa
  register('/altro', () => { window.location.hash = '/spesa'; });

  const navbar = document.getElementById('navbar');
  renderNavbar(navbar);
  window.addEventListener('hashchange', () => renderNavbar(navbar));

  initRouter();

  const { requestPermission, startPeriodicCheck } = await import('./notifications.js' + V);
  const granted = await requestPermission();
  if (granted) startPeriodicCheck();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

boot();
