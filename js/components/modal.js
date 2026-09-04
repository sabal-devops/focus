let activeModal = null;

export function open(title, contentHTML, onSubmit) {
  close();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <h2>${title}</h2>
      <div class="modal-body">${contentHTML}</div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onSubmit) {
    const form = overlay.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        onSubmit(data);
        close();
      });
    }
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  activeModal = overlay;
  return overlay;
}

export function close() {
  if (!activeModal) return;
  activeModal.classList.remove('active');
  setTimeout(() => {
    if (activeModal && activeModal.parentNode) {
      activeModal.parentNode.removeChild(activeModal);
    }
    activeModal = null;
  }, 300);
}
