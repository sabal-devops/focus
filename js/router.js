const routes = {};
let currentView = null;
let currentPath = null;

const NAV_ORDER = ['/', '/chat', '/agenda', '/finanze', '/altro', '/spesa', '/dispensa', '/settings'];

function getNavIndex(path) {
  const idx = NAV_ORDER.indexOf(path);
  return idx >= 0 ? idx : 99;
}

export function register(path, viewFn) {
  routes[path] = viewFn;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/';
}

async function render() {
  const path = getCurrentRoute();
  const viewFn = routes[path] || routes['/'];
  if (!viewFn) return;

  const container = document.getElementById('view');

  if (currentView && currentView.destroy) {
    currentView.destroy();
  }

  const goingForward = currentPath === null || getNavIndex(path) > getNavIndex(currentPath);
  const animClass = goingForward ? 'slide-in-right' : 'slide-in-left';

  container.innerHTML = '';
  container.scrollTop = 0;
  container.classList.remove('slide-in-right', 'slide-in-left');
  void container.offsetWidth;
  container.classList.add(animClass);

  currentView = await viewFn(container);
  currentPath = path;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('href') === '#' + path);
  });
}

export function init() {
  window.addEventListener('hashchange', render);
  if (!window.location.hash) {
    window.location.hash = '/';
  }
  render();
}
