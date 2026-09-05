const items = [
  { path: '/spesa', icon: '🛒', label: 'Lista spesa', desc: 'Prodotti da comprare' },
  { path: '/dispensa', icon: '🏠', label: 'Dispensa', desc: 'Inventario di casa' },
  { path: '/settings', icon: '⚙️', label: 'Impostazioni', desc: 'AI, backup, dati' },
];

export function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Altro</h1>
      </div>
      <div id="altro-list">
        ${items.map(item => `
          <a href="#${item.path}" class="list-item" style="text-decoration:none;cursor:pointer">
            <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${item.icon}</div>
            <div class="item-text">
              <div class="item-title">${item.label}</div>
              <div class="item-subtitle">${item.desc}</div>
            </div>
            <div style="color:var(--text-muted);font-size:18px">›</div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}
