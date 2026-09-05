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

  const modalEl = overlay.querySelector('.modal');
  setupSwipeToDismiss(modalEl);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  activeModal = overlay;
  return overlay;
}

function setupSwipeToDismiss(modalEl) {
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  modalEl.addEventListener('touchstart', (e) => {
    const target = e.target;
    if (target.closest('input, select, textarea')) return;
    if (modalEl.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    dragging = true;
    modalEl.style.transition = 'none';
  }, { passive: true });

  modalEl.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY - startY;
    if (currentY < 0) currentY = 0;
    modalEl.style.transform = `translateY(${currentY}px)`;
  }, { passive: true });

  modalEl.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    modalEl.style.transition = '';
    if (currentY > 100) {
      close();
    } else {
      modalEl.style.transform = '';
    }
    currentY = 0;
  });
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
