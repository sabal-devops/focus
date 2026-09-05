let toastEl = null;
let hideTimer = null;

function ensure() {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.className = 'global-toast';
  document.body.appendChild(toastEl);
}

export function show(text, duration = 2500) {
  ensure();
  clearTimeout(hideTimer);
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  hideTimer = setTimeout(() => toastEl.classList.remove('visible'), duration);
}
