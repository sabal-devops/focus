import { open } from './db.js';
import { register, init as initRouter } from './router.js';
import { render as renderNavbar } from './components/navbar.js';

async function boot() {
  await open();

  const { render: homeView } = await import('./views/home.js');
  const { render: chatView } = await import('./views/chat.js');
  const { render: agendaView, destroy: agendaDestroy } = await import('./views/agenda.js');
  const { render: spesaView, destroy: spesaDestroy } = await import('./views/spesa.js');
  const { render: dispensaView, destroy: dispensaDestroy } = await import('./views/dispensa.js');
  const { render: finanzeView, destroy: finanzeDestroy } = await import('./views/finanze.js');
  const { render: altroView } = await import('./views/altro.js');
  const { render: settingsView } = await import('./views/settings.js');

  register('/', (c) => { homeView(c); });
  register('/chat', (c) => { chatView(c); });
  register('/agenda', (c) => { agendaView(c); return { destroy: agendaDestroy }; });
  register('/spesa', (c) => { spesaView(c); return { destroy: spesaDestroy }; });
  register('/dispensa', (c) => { dispensaView(c); return { destroy: dispensaDestroy }; });
  register('/finanze', (c) => { finanzeView(c); return { destroy: finanzeDestroy }; });
  register('/altro', (c) => { altroView(c); });
  register('/settings', (c) => { settingsView(c); });

  const navbar = document.getElementById('navbar');
  renderNavbar(navbar);
  window.addEventListener('hashchange', () => renderNavbar(navbar));

  initRouter();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

boot();
