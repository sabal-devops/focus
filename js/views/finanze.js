import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on } from '../store.js';

let unsub = null;

const CATEGORIE = ['Alimentazione', 'Casa', 'Trasporti', 'Svago', 'Salute', 'Abbonamenti', 'Altro'];
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Finanze</h1>
        <p id="finanze-periodo"></p>
      </div>
      <div id="finanze-summary"></div>
      <div id="finanze-chart"></div>
      <div id="finanze-list"></div>
    </div>
    <button class="fab" id="finanze-add">+</button>
  `;

  document.getElementById('finanze-add').addEventListener('click', openAddModal);
  unsub = on('data-changed', () => loadData());
  await loadData();
}

export function destroy() {
  if (unsub) unsub();
}

async function loadData() {
  const all = await db.getAll('transazioni');
  const now = new Date();
  const mese = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  document.getElementById('finanze-periodo').textContent = mese.charAt(0).toUpperCase() + mese.slice(1);

  const meseCorrente = all.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const uscite = meseCorrente.filter(t => t.tipo === 'uscita');
  const entrate = meseCorrente.filter(t => t.tipo === 'entrata');
  const totaleUscite = uscite.reduce((s, t) => s + t.importo, 0);
  const totaleEntrate = entrate.reduce((s, t) => s + t.importo, 0);

  const perCategoria = {};
  for (const t of uscite) {
    const cat = t.categoria || 'Altro';
    perCategoria[cat] = (perCategoria[cat] || 0) + t.importo;
  }

  const summaryEl = document.getElementById('finanze-summary');
  summaryEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-md)">
      <div class="card">
        <div class="item-subtitle">Uscite</div>
        <div class="item-title" style="font-size:var(--font-xl);color:var(--danger)">-€${totaleUscite.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="item-subtitle">Entrate</div>
        <div class="item-title" style="font-size:var(--font-xl);color:var(--success)">+€${totaleEntrate.toFixed(2)}</div>
      </div>
    </div>
    ${Object.keys(perCategoria).length > 0 ? `
      <div class="card">
        <div class="card-header"><span class="card-title">Per categoria</span></div>
        ${Object.entries(perCategoria)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, tot]) => {
            const pct = totaleUscite > 0 ? (tot / totaleUscite * 100) : 0;
            return `
              <div style="margin-bottom:var(--space-sm)">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span class="item-subtitle">${cat}</span>
                  <span class="item-subtitle">€${tot.toFixed(2)}</span>
                </div>
                <div style="height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:width 0.3s"></div>
                </div>
              </div>
            `;
          }).join('')}
      </div>
    ` : ''}
  `;

  renderChart(all, now);

  const listEl = document.getElementById('finanze-list');
  const recenti = all.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 20);

  if (recenti.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">💰</div>
        <p>Nessuna transazione registrata.<br>Aggiungi una spesa o raccontala in chat!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="section-title">Ultime transazioni</div>
    ${recenti.map(t => `
      <div class="list-item" data-id="${t.id}">
        <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${t.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          ${t.tipo === 'uscita' ? '↑' : '↓'}
        </div>
        <div class="item-text">
          <div class="item-title">${t.descrizione || t.categoria || 'Transazione'}</div>
          <div class="item-subtitle">${new Date(t.data).toLocaleDateString('it-IT')} · ${t.categoria || ''}</div>
        </div>
        <div style="font-weight:600;color:${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}">
          ${t.tipo === 'uscita' ? '-' : '+'}€${t.importo.toFixed(2)}
        </div>
      </div>
    `).join('')}
  `;

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => deleteTransaction(Number(el.dataset.id)));
  });
}

function renderChart(transactions, now) {
  const chartEl = document.getElementById('finanze-chart');
  if (!chartEl) return;

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: MESI[d.getMonth()] });
  }

  const data = months.map(m => {
    const mTx = transactions.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    });
    return {
      label: m.label,
      uscite: mTx.filter(t => t.tipo === 'uscita').reduce((s, t) => s + t.importo, 0),
      entrate: mTx.filter(t => t.tipo === 'entrata').reduce((s, t) => s + t.importo, 0),
    };
  });

  const maxVal = Math.max(1, ...data.map(d => Math.max(d.uscite, d.entrate)));
  const hasData = data.some(d => d.uscite > 0 || d.entrate > 0);

  if (!hasData) {
    chartEl.innerHTML = '';
    return;
  }

  const barH = 120;

  chartEl.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-header"><span class="card-title">Ultimi 6 mesi</span></div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:${barH + 30}px;padding-top:var(--space-sm)">
        ${data.map(d => {
          const hU = d.uscite > 0 ? Math.max(4, (d.uscite / maxVal) * barH) : 0;
          const hE = d.entrate > 0 ? Math.max(4, (d.entrate / maxVal) * barH) : 0;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="display:flex;gap:2px;align-items:flex-end;height:${barH}px">
                <div style="width:12px;height:${hU}px;background:var(--danger);border-radius:3px 3px 0 0;transition:height 0.4s" title="Uscite: €${d.uscite.toFixed(2)}"></div>
                <div style="width:12px;height:${hE}px;background:var(--success);border-radius:3px 3px 0 0;transition:height 0.4s" title="Entrate: €${d.entrate.toFixed(2)}"></div>
              </div>
              <span style="font-size:10px;color:var(--text-muted)">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:var(--space-md);justify-content:center;margin-top:var(--space-sm)">
        <span style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--danger);display:inline-block"></span>Uscite</span>
        <span style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--success);display:inline-block"></span>Entrate</span>
      </div>
    </div>
  `;
}

async function deleteTransaction(id) {
  if (confirm('Eliminare questa transazione?')) {
    await db.del('transazioni', id);
    loadData();
  }
}

function openAddModal() {
  modal.open('Nuova transazione', `
    <form>
      <div class="form-group">
        <label class="form-label">Importo (€)</label>
        <input type="number" step="0.01" name="importo" class="input-field" placeholder="0.00" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          <option value="uscita">Uscita</option>
          <option value="entrata">Entrata</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="input-field">
          ${CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Descrizione (opzionale)</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Pranzo al bar">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    await db.add('transazioni', {
      importo: parseFloat(data.importo),
      tipo: data.tipo,
      categoria: data.categoria,
      descrizione: data.descrizione || null,
      data: new Date().toISOString()
    });
    loadData();
  });
}
