import * as db from '../db.js';
import * as ai from '../ai.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="font-size:var(--font-hero)">Focus</h1>
          <p id="home-greeting" style="font-size:var(--font-md);margin-top:6px;-webkit-text-fill-color:var(--text-secondary)">Il tuo hub personale</p>
        </div>
        <a href="#/settings" class="btn-circle" style="margin-top:8px;background:var(--bg-card);border:1px solid var(--border)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </a>
      </div>
      <div id="home-ai-status"></div>
      <div id="home-alerts"></div>
      <div id="home-summary"></div>
      <div id="home-recent"></div>
    </div>
  `;

  setGreeting();
  checkAiStatus();
  await loadDashboard();
}

function setGreeting() {
  const el = document.getElementById('home-greeting');
  const hour = new Date().getHours();
  if (hour < 6) el.textContent = 'Buonanotte';
  else if (hour < 12) el.textContent = 'Buongiorno';
  else if (hour < 18) el.textContent = 'Buon pomeriggio';
  else el.textContent = 'Buonasera';
}

async function checkAiStatus() {
  const el = document.getElementById('home-ai-status');
  const available = await ai.isAvailable();
  if (available) {
    el.innerHTML = `
      <div class="card" style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) var(--space-md)">
        <span class="status-dot online"></span>
        <span class="item-subtitle">AI connessa</span>
      </div>
    `;
  }
}

async function loadDashboard() {
  const alertsEl = document.getElementById('home-alerts');
  const summaryEl = document.getElementById('home-summary');
  const recentEl = document.getElementById('home-recent');

  const spesaItems = await db.getAll('spesa');
  const dispensaItems = await db.getAll('dispensa');
  const transazioni = await db.getAll('transazioni');
  const eventi = await db.getAll('eventi');
  const scadenze = await db.getAll('scadenze');

  const daComprare = spesaItems.filter(i => !i.completato);
  const terminati = dispensaItems.filter(i => i.quantita === 0);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const prossimiEventi = eventi
    .filter(e => new Date(e.data) >= today)
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 3);

  const scadenzeUrgenti = scadenze
    .filter(s => !s.completata && Math.ceil((new Date(s.data) - today) / 86400000) <= 30)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const meseCorrente = transazioni.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totaleUscite = meseCorrente.filter(t => t.tipo === 'uscita').reduce((s, t) => s + t.importo, 0);

  const mesePrecedente = transazioni.filter(t => {
    const d = new Date(t.data);
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return t.tipo === 'uscita' && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const totalePrecedente = mesePrecedente.reduce((s, t) => s + t.importo, 0);

  const alerts = [];

  if (terminati.length > 0) {
    alerts.push({ icon: '!', text: `${terminati.map(i => i.nome).join(', ')} ${terminati.length === 1 ? 'terminato' : 'terminati'}`, type: 'danger' });
  }

  const scorteBasse = dispensaItems.filter(i => i.quantita !== null && i.quantita > 0 && i.quantita <= 1);
  if (scorteBasse.length > 0) {
    alerts.push({ icon: '~', text: `${scorteBasse.map(i => i.nome).join(', ')} quasi ${scorteBasse.length === 1 ? 'finito' : 'finiti'}`, type: 'warning' });
  }

  if (daComprare.length > 0) {
    alerts.push({ icon: daComprare.length, text: `prodott${daComprare.length === 1 ? 'o' : 'i'} da comprare`, type: 'accent' });
  }

  const scaduta = scadenzeUrgenti.filter(s => new Date(s.data) < today);
  const prossime = scadenzeUrgenti.filter(s => new Date(s.data) >= today);
  if (scaduta.length > 0) {
    alerts.push({ icon: '!', text: `${scaduta.map(s => s.titolo).join(', ')} — scaduto!`, type: 'danger' });
  }
  if (prossime.length > 0) {
    const first = prossime[0];
    const days = Math.ceil((new Date(first.data) - today) / 86400000);
    alerts.push({ icon: days, text: `${first.titolo} — tra ${days}gg`, type: 'warning' });
  }

  if (prossimiEventi.length > 0) {
    const next = prossimiEventi[0];
    const d = new Date(next.data);
    const diff = Math.ceil((d - today) / 86400000);
    const quando = diff === 0 ? 'oggi' : diff === 1 ? 'domani' : d.toLocaleDateString('it-IT', { weekday: 'short' });
    alerts.push({ icon: quando.slice(0, 3), text: `${next.titolo}${next.ora ? ' alle ' + next.ora : ''}`, type: 'accent' });
  }

  if (totalePrecedente > 0 && totaleUscite > totalePrecedente * 1.2) {
    const diff = ((totaleUscite / totalePrecedente - 1) * 100).toFixed(0);
    alerts.push({ icon: `+${diff}%`, text: `spese vs mese scorso`, type: 'warning' });
  }

  const alertColors = { danger: 'var(--danger)', warning: 'var(--warning)', accent: 'var(--accent)' };
  const alertBg = { danger: 'var(--danger-soft)', warning: 'var(--warning-soft)', accent: 'var(--accent-soft)' };

  if (alerts.length > 0) {
    alertsEl.innerHTML = `
      <div class="section-title">Avvisi</div>
      ${alerts.map(a => `
        <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px var(--space-md)">
          <div style="width:36px;height:36px;border-radius:10px;background:${alertBg[a.type]};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${alertColors[a.type]};flex-shrink:0">${a.icon}</div>
          <span style="font-size:var(--font-sm);font-weight:500">${a.text}</span>
        </div>
      `).join('')}
    `;
  } else {
    alertsEl.innerHTML = `
      <div style="background:var(--gradient-card-indigo);border-radius:var(--radius-md);padding:var(--space-xl);text-align:center;margin-bottom:var(--space-md);border:1px solid var(--border)">
        <div style="width:48px;height:48px;border-radius:var(--radius-full);background:var(--accent-soft);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="item-title" style="font-size:var(--font-lg);margin-bottom:4px">Tutto in ordine</div>
        <div class="item-subtitle">Nessun avviso per ora</div>
      </div>
    `;
  }

  const mese = now.toLocaleDateString('it-IT', { month: 'long' });
  const meseCapitalized = mese.charAt(0).toUpperCase() + mese.slice(1);
  summaryEl.innerHTML = `
    <div class="section-title">Riepilogo ${meseCapitalized}</div>
    <div class="stat-grid">
      <div class="stat-card" style="background:var(--gradient-card-purple)">
        <div class="stat-icon" style="color:var(--accent)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        </div>
        <div class="stat-value">${daComprare.length}</div>
        <div class="stat-label">da comprare</div>
      </div>
      <div class="stat-card" style="background:var(--gradient-card-indigo)">
        <div class="stat-icon" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-value" style="color:var(--danger)">€${totaleUscite.toFixed(0)}</div>
        <div class="stat-label">spese</div>
      </div>
      <div class="stat-card" style="background:var(--gradient-card-cyan)">
        <div class="stat-icon" style="color:var(--accent-secondary)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="stat-value">${dispensaItems.length}</div>
        <div class="stat-label">in dispensa</div>
      </div>
    </div>
  `;

  const recentTx = transazioni.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
  if (recentTx.length > 0) {
    recentEl.innerHTML = `
      <div class="section-title">Ultime attività</div>
      ${recentTx.map(t => `
        <div class="list-item">
          <div style="width:36px;height:36px;border-radius:10px;background:${t.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${t.tipo === 'uscita' ? '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'}
            </svg>
          </div>
          <div class="item-text">
            <div class="item-title" style="font-size:var(--font-sm)">${t.descrizione || t.categoria}</div>
            <div class="item-subtitle">${new Date(t.data).toLocaleDateString('it-IT')}</div>
          </div>
          <div style="font-size:var(--font-sm);font-weight:700;color:${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}">
            ${t.tipo === 'uscita' ? '-' : '+'}€${t.importo.toFixed(2)}
          </div>
        </div>
      `).join('')}
    `;
  }
}
