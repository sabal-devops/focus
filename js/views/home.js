import * as db from '../db.js';
import * as ai from '../ai.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="font-size:32px;letter-spacing:-1px">Focus</h1>
          <p id="home-greeting" style="font-size:var(--font-md);margin-top:6px">Il tuo hub personale</p>
        </div>
        <a href="#/settings" class="btn btn-ghost btn-icon" style="margin-top:4px;background:var(--bg-card);border:1px solid var(--border-light)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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

  const daComprare = spesaItems.filter(i => !i.completato);
  const scorteBasse = dispensaItems.filter(i => i.quantita !== null && i.quantita <= 1);
  const terminati = dispensaItems.filter(i => i.quantita === 0);

  const now = new Date();
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
    alerts.push({
      icon: '🔴',
      text: `${terminati.map(i => i.nome).join(', ')} ${terminati.length === 1 ? 'è terminato' : 'sono terminati'}`,
      type: 'danger'
    });
  }

  if (scorteBasse.length > 0 && scorteBasse.length !== terminati.length) {
    const quasiFiniti = scorteBasse.filter(i => i.quantita > 0);
    if (quasiFiniti.length > 0) {
      alerts.push({
        icon: '🟡',
        text: `${quasiFiniti.map(i => i.nome).join(', ')} quasi ${quasiFiniti.length === 1 ? 'finito' : 'finiti'}`,
        type: 'warning'
      });
    }
  }

  if (daComprare.length > 0) {
    alerts.push({
      icon: '🛒',
      text: `${daComprare.length} ${daComprare.length === 1 ? 'prodotto' : 'prodotti'} da comprare`,
      type: 'accent'
    });
  }

  if (totalePrecedente > 0 && totaleUscite > totalePrecedente * 1.2) {
    const diff = ((totaleUscite / totalePrecedente - 1) * 100).toFixed(0);
    alerts.push({
      icon: '📊',
      text: `Stai spendendo il ${diff}% in più rispetto al mese scorso`,
      type: 'warning'
    });
  }

  if (alerts.length > 0) {
    alertsEl.innerHTML = `
      <div class="section-title">Attenzione</div>
      ${alerts.map(a => `
        <div class="card" style="display:flex;align-items:center;gap:var(--space-md)">
          <span style="font-size:20px">${a.icon}</span>
          <span class="item-title" style="font-size:var(--font-sm)">${a.text}</span>
        </div>
      `).join('')}
    `;
  } else {
    alertsEl.innerHTML = `
      <div style="background:linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.06), rgba(6,182,212,0.08));border-radius:var(--radius-lg);padding:var(--space-xl);text-align:center;margin-bottom:var(--space-md);border:1px solid var(--border-light)">
        <div style="width:52px;height:52px;border-radius:var(--radius-full);background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(52,211,153,0.15));display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md);font-size:22px">✓</div>
        <div class="item-title" style="font-size:var(--font-lg);margin-bottom:4px">Tutto in ordine</div>
        <div class="item-subtitle">Nessun avviso per ora</div>
      </div>
    `;
  }

  const mese = now.toLocaleDateString('it-IT', { month: 'long' });
  const meseCapitalized = mese.charAt(0).toUpperCase() + mese.slice(1);
  summaryEl.innerHTML = `
    <div class="section-title">Riepilogo ${meseCapitalized}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-sm)">
      <div style="background:linear-gradient(145deg, rgba(139,92,246,0.12), #141830);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;border:1px solid rgba(139,92,246,0.15);box-shadow:var(--shadow-card)">
        <div style="font-size:18px;margin-bottom:6px">🛒</div>
        <div style="font-size:var(--font-xl);font-weight:700">${daComprare.length}</div>
        <div class="item-subtitle" style="font-size:11px">da comprare</div>
      </div>
      <div style="background:linear-gradient(145deg, rgba(99,102,241,0.12), #141830);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;border:1px solid rgba(99,102,241,0.15);box-shadow:var(--shadow-card)">
        <div style="font-size:18px;margin-bottom:6px">💸</div>
        <div style="font-size:var(--font-xl);font-weight:700;color:var(--danger)">€${totaleUscite.toFixed(0)}</div>
        <div class="item-subtitle" style="font-size:11px">spese</div>
      </div>
      <div style="background:linear-gradient(145deg, rgba(6,182,212,0.12), #141830);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;border:1px solid rgba(6,182,212,0.15);box-shadow:var(--shadow-card)">
        <div style="font-size:18px;margin-bottom:6px">🏠</div>
        <div style="font-size:var(--font-xl);font-weight:700">${dispensaItems.length}</div>
        <div class="item-subtitle" style="font-size:11px">in dispensa</div>
      </div>
    </div>
  `;

  const recentTx = transazioni.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
  if (recentTx.length > 0) {
    recentEl.innerHTML = `
      <div class="section-title">Ultime attività</div>
      ${recentTx.map(t => `
        <div class="list-item">
          <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${t.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
            ${t.tipo === 'uscita' ? '↑' : '↓'}
          </div>
          <div class="item-text">
            <div class="item-title" style="font-size:var(--font-sm)">${t.descrizione || t.categoria}</div>
            <div class="item-subtitle">${new Date(t.data).toLocaleDateString('it-IT')}</div>
          </div>
          <div style="font-size:var(--font-sm);font-weight:600;color:${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}">
            ${t.tipo === 'uscita' ? '-' : '+'}€${t.importo.toFixed(2)}
          </div>
        </div>
      `).join('')}
    `;
  }
}
