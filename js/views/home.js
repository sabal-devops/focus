import * as db from '../db.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>NODO</h1>
        <p>Il tuo hub personale</p>
      </div>
      <div id="home-alerts"></div>
      <div id="home-summary"></div>
    </div>
  `;

  await loadSummary();
}

async function loadSummary() {
  const alertsEl = document.getElementById('home-alerts');
  const summaryEl = document.getElementById('home-summary');

  const spesaItems = await db.getAll('spesa');
  const dispensaItems = await db.getAll('dispensa');
  const transazioni = await db.getAll('transazioni');

  const daCcomprare = spesaItems.filter(i => !i.completato).length;
  const scorteBasase = dispensaItems.filter(i => i.quantita <= 1).length;

  const now = new Date();
  const meseCorrente = transazioni.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totaleSpese = meseCorrente.filter(t => t.tipo === 'uscita').reduce((s, t) => s + t.importo, 0);

  const alerts = [];
  if (daCcomprare > 0) alerts.push({ icon: '🛒', text: `${daCcomprare} prodotti da comprare`, badge: 'accent' });
  if (scorteBasase > 0) alerts.push({ icon: '⚠️', text: `${scorteBasase} scorte in esaurimento`, badge: 'warning' });

  if (alerts.length > 0) {
    alertsEl.innerHTML = `
      <div class="section-title">Attenzione</div>
      ${alerts.map(a => `
        <div class="card" style="display:flex;align-items:center;gap:var(--space-md)">
          <span style="font-size:24px">${a.icon}</span>
          <span class="item-title">${a.text}</span>
        </div>
      `).join('')}
    `;
  } else {
    alertsEl.innerHTML = `
      <div class="card" style="text-align:center;padding:var(--space-lg)">
        <div style="font-size:32px;margin-bottom:var(--space-sm)">✓</div>
        <div class="item-title">Tutto in ordine</div>
        <div class="item-subtitle">Nessun avviso per ora</div>
      </div>
    `;
  }

  summaryEl.innerHTML = `
    <div class="section-title">Riepilogo</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
      <div class="card">
        <div class="item-subtitle">Spesa</div>
        <div class="item-title" style="font-size:var(--font-xl)">${daCcomprare}</div>
        <div class="item-subtitle">da comprare</div>
      </div>
      <div class="card">
        <div class="item-subtitle">Questo mese</div>
        <div class="item-title" style="font-size:var(--font-xl)">€${totaleSpese.toFixed(0)}</div>
        <div class="item-subtitle">spese totali</div>
      </div>
    </div>
  `;
}
