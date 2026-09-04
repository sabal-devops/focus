const routes = {};
let currentView = null;

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

  container.innerHTML = '';
  container.scrollTop = 0;
  currentView = await viewFn(container);

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
