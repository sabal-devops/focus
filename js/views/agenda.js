import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on } from '../store.js';

let unsub = null;
let activeTab = 'eventi';

const RICORRENZE = [
  { value: '', label: 'Nessuna' },
  { value: 'settimanale', label: 'Ogni settimana' },
  { value: 'bisettimanale', label: 'Ogni 2 settimane' },
  { value: 'mensile', label: 'Ogni mese' },
  { value: 'annuale', label: 'Ogni anno' },
];

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Agenda</h1>
        <p>I tuoi impegni e scadenze</p>
      </div>
      <div id="agenda-tabs" style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-md)">
        <button class="agenda-tab active" data-tab="eventi" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--accent);color:#fff;border:none">Eventi</button>
        <button class="agenda-tab" data-tab="scadenze" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Scadenze</button>
      </div>
      <div id="agenda-content"></div>
    </div>
    <button class="fab" id="agenda-add">+</button>
  `;

  container.querySelectorAll('.agenda-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateTabs(container);
      loadContent();
    });
  });

  document.getElementById('agenda-add').addEventListener('click', () => {
    if (activeTab === 'eventi') openAddEvento();
    else openAddScadenza();
  });

  unsub = on('data-changed', () => loadContent());
  await loadContent();
}

export function destroy() {
  if (unsub) unsub();
}

function updateTabs(container) {
  container.querySelectorAll('.agenda-tab').forEach(btn => {
    if (btn.dataset.tab === activeTab) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.classList.add('active');
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.border = '1px solid var(--border-light)';
      btn.classList.remove('active');
    }
  });
}

async function loadContent() {
  if (activeTab === 'eventi') await loadEventi();
  else await loadScadenze();
}

function expandRecurring(events) {
  const expanded = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + 3);

  for (const e of events) {
    expanded.push(e);

    if (!e.ricorrenza) continue;

    const baseDate = new Date(e.data);
    baseDate.setHours(0, 0, 0, 0);
    let current = new Date(baseDate);

    for (let i = 0; i < 52; i++) {
      current = nextOccurrence(current, e.ricorrenza);
      if (current > horizon) break;

      const dateStr = current.toISOString().slice(0, 10);
      const alreadyExists = events.some(ev =>
        ev.titolo === e.titolo && ev.data === dateStr && ev.id !== e.id
      );
      if (alreadyExists) continue;

      expanded.push({
        ...e,
        id: e.id,
        data: dateStr,
        _virtual: true,
        _originId: e.id,
      });
    }
  }

  return expanded;
}

function nextOccurrence(date, tipo) {
  const d = new Date(date);
  switch (tipo) {
    case 'settimanale': d.setDate(d.getDate() + 7); break;
    case 'bisettimanale': d.setDate(d.getDate() + 14); break;
    case 'mensile': d.setMonth(d.getMonth() + 1); break;
    case 'annuale': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

async function loadEventi() {
  const contentEl = document.getElementById('agenda-content');
  if (!contentEl) return;

  const eventiRaw = await db.getAll('eventi');
  const eventi = expandRecurring(eventiRaw);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const futuri = eventi
    .filter(e => new Date(e.data) >= now)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const passati = eventiRaw
    .filter(e => new Date(e.data) < now)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (eventiRaw.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📅</div>
        <p>Nessun evento in agenda.<br>Aggiungine uno o scrivi in chat!<br><br>Prova: "Ho il dentista giovedì alle 15"</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = '';

  if (futuri.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Prossimi</div>`;
    contentEl.innerHTML += futuri.map(e => eventoHTML(e)).join('');
  }

  if (passati.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Passati</div>`;
    contentEl.innerHTML += passati.slice(0, 10).map(e => eventoHTML(e, true)).join('');
  }

  bindEventListeners(contentEl, 'eventi');
}

async function loadScadenze() {
  const contentEl = document.getElementById('agenda-content');
  if (!contentEl) return;

  const scadenzeRaw = await db.getAll('scadenze');
  const scadenze = expandRecurringScadenze(scadenzeRaw);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const attive = scadenze
    .filter(s => !s.completata)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const completate = scadenzeRaw
    .filter(s => s.completata)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (scadenzeRaw.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>Nessuna scadenza registrata.<br>Aggiungine una o scrivi in chat!<br><br>Prova: "La patente scade il 15 marzo 2027"</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = '';

  if (attive.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Da fare (${attive.length})</div>`;
    contentEl.innerHTML += attive.map(s => scadenzaHTML(s, now)).join('');
  }

  if (completate.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Completate</div>`;
    contentEl.innerHTML += completate.slice(0, 10).map(s => scadenzaHTML(s, now)).join('');
  }

  bindEventListeners(contentEl, 'scadenze');
}

function expandRecurringScadenze(scadenze) {
  const expanded = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + 3);

  for (const s of scadenze) {
    expanded.push(s);
    if (!s.ricorrenza || s.completata) continue;

    let current = new Date(s.data);
    for (let i = 0; i < 24; i++) {
      current = nextOccurrence(current, s.ricorrenza);
      if (current > horizon) break;
      const dateStr = current.toISOString().slice(0, 10);
      expanded.push({ ...s, data: dateStr, _virtual: true, _originId: s.id, completata: false });
    }
  }
  return expanded;
}

function eventoHTML(evento, passato = false) {
  const d = new Date(evento.data);
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const ora = evento.ora || '';
  const icons = { appuntamento: '🏥', lavoro: '💼', personale: '👤', sport: '🏃', altro: '📌' };
  const icon = icons[evento.tipo] || '📌';
  const costo = evento.costo ? `€${evento.costo.toFixed(2)}` : '';
  const ricBadge = evento.ricorrenza ? ricorrenzaBadge(evento.ricorrenza) : '';
  const isVirtual = evento._virtual ? ' data-virtual="true"' : '';

  return `
    <div class="list-item${passato ? ' checked' : ''}" data-id="${evento._originId || evento.id}" data-store="eventi"${isVirtual}>
      <div style="font-size:20px">${icon}</div>
      <div class="item-text">
        <div class="item-title">${evento.titolo}${ricBadge}</div>
        <div class="item-subtitle">${giorno}${ora ? ' · ' + ora : ''}${evento.luogo ? ' · ' + evento.luogo : ''}${costo ? ' · <span style="color:var(--danger);font-weight:600">' + costo + '</span>' : ''}</div>
      </div>
      ${!evento._virtual ? `<button class="btn btn-ghost btn-icon delete-btn" data-id="${evento.id}" data-store="eventi" style="font-size:16px;color:var(--text-muted)">✕</button>` : ''}
    </div>
  `;
}

function ricorrenzaBadge(tipo) {
  const labels = { settimanale: '🔁 sett.', bisettimanale: '🔁 2 sett.', mensile: '🔁 mens.', annuale: '🔁 ann.' };
  return ` <span style="font-size:10px;color:var(--accent-secondary);font-weight:400">${labels[tipo] || ''}</span>`;
}

function scadenzaHTML(scadenza, now) {
  const d = new Date(scadenza.data);
  const giorno = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

  let urgency = '';
  let urgencyColor = '';
  if (!scadenza.completata) {
    if (diff < 0) { urgency = `Scaduta da ${Math.abs(diff)}g`; urgencyColor = 'var(--danger)'; }
    else if (diff === 0) { urgency = 'Scade oggi!'; urgencyColor = 'var(--danger)'; }
    else if (diff <= 7) { urgency = `Tra ${diff} giorni`; urgencyColor = 'var(--warning)'; }
    else if (diff <= 30) { urgency = `Tra ${diff} giorni`; urgencyColor = 'var(--accent-secondary)'; }
    else { urgency = `Tra ${diff} giorni`; urgencyColor = 'var(--text-muted)'; }
  }

  const catIcons = { documento: '📄', veicolo: '🚗', casa: '🏠', salute: '🏥', abbonamento: '📱', altro: '📋' };
  const icon = catIcons[scadenza.categoria] || '📋';
  const costo = scadenza.costo ? `€${scadenza.costo.toFixed(2)}` : '';
  const ricBadge = scadenza.ricorrenza ? ricorrenzaBadge(scadenza.ricorrenza) : '';

  return `
    <div class="list-item${scadenza.completata ? ' checked' : ''}" data-id="${scadenza._originId || scadenza.id}" data-store="scadenze"${scadenza._virtual ? ' data-virtual="true"' : ''}>
      ${!scadenza._virtual ? `<div class="check" data-id="${scadenza.id}" data-store="scadenze"></div>` : '<div style="width:24px"></div>'}
      <div class="item-text">
        <div class="item-title">${icon} ${scadenza.titolo}${ricBadge}</div>
        <div class="item-subtitle">${giorno}${urgency ? ` · <span style="color:${urgencyColor};font-weight:600">${urgency}</span>` : ''}${costo ? ' · <span style="color:var(--danger)">' + costo + '</span>' : ''}</div>
        ${scadenza.descrizione ? `<div class="item-subtitle">${scadenza.descrizione}</div>` : ''}
      </div>
      ${!scadenza._virtual ? `<button class="btn btn-ghost btn-icon delete-btn" data-id="${scadenza.id}" data-store="scadenze" style="font-size:16px;color:var(--text-muted)">✕</button>` : ''}
    </div>
  `;
}

function bindEventListeners(container, store) {
  container.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.del(el.dataset.store, Number(el.dataset.id));
      loadContent();
    });
  });

  if (store === 'scadenze') {
    container.querySelectorAll('.check').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const item = await db.get('scadenze', Number(el.dataset.id));
        if (item) {
          item.completata = !item.completata;
          await db.put('scadenze', item);
          loadContent();
        }
      });
    });
  }

  if (store === 'eventi') {
    container.querySelectorAll('.list-item[data-store="eventi"]:not([data-virtual="true"])').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return;
        editEvento(Number(el.dataset.id));
      });
    });
  }
}

function ricorrenzaSelect(selected) {
  return `
    <div class="form-group">
      <label class="form-label">Ricorrenza</label>
      <select name="ricorrenza" class="input-field">
        ${RICORRENZE.map(r => `<option value="${r.value}"${r.value === (selected || '') ? ' selected' : ''}>${r.label}</option>`).join('')}
      </select>
    </div>
  `;
}

async function editEvento(id) {
  const evento = await db.get('eventi', id);
  if (!evento) return;

  modal.open('Modifica evento', `
    <form>
      <div class="form-group">
        <label class="form-label">Titolo</label>
        <input type="text" name="titolo" class="input-field" value="${evento.titolo}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" name="data" class="input-field" value="${evento.data.slice(0, 10)}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Ora (opzionale)</label>
        <input type="time" name="ora" class="input-field" value="${evento.ora || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Luogo (opzionale)</label>
        <input type="text" name="luogo" class="input-field" value="${evento.luogo || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Costo (€, opzionale)</label>
        <input type="number" step="0.01" name="costo" class="input-field" value="${evento.costo || ''}" placeholder="0.00">
      </div>
      ${ricorrenzaSelect(evento.ricorrenza)}
      <div class="form-group">
        <label class="form-label">Note (opzionale)</label>
        <input type="text" name="note" class="input-field" value="${evento.note || ''}" placeholder="Appunti...">
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          ${['appuntamento', 'lavoro', 'personale', 'sport', 'altro'].map(t =>
            `<option value="${t}"${evento.tipo === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    const newCosto = data.costo ? parseFloat(data.costo) : null;
    const oldCosto = evento.costo || null;

    evento.titolo = data.titolo;
    evento.data = data.data;
    evento.ora = data.ora || null;
    evento.luogo = data.luogo || null;
    evento.tipo = data.tipo;
    evento.costo = newCosto;
    evento.ricorrenza = data.ricorrenza || null;
    evento.note = data.note || null;
    await db.put('eventi', evento);

    if (newCosto && newCosto !== oldCosto) {
      await db.add('transazioni', {
        importo: newCosto, tipo: 'uscita',
        categoria: guessEventCategory(evento.titolo),
        descrizione: evento.titolo,
        data: new Date(evento.data).toISOString()
      });
    }

    loadContent();
  });
}

function openAddEvento() {
  const today = new Date().toISOString().slice(0, 10);
  modal.open('Nuovo evento', `
    <form>
      <div class="form-group">
        <label class="form-label">Titolo</label>
        <input type="text" name="titolo" class="input-field" placeholder="Es. Dentista" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" name="data" class="input-field" value="${today}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Ora (opzionale)</label>
        <input type="time" name="ora" class="input-field">
      </div>
      <div class="form-group">
        <label class="form-label">Luogo (opzionale)</label>
        <input type="text" name="luogo" class="input-field" placeholder="Es. Via Roma 10">
      </div>
      <div class="form-group">
        <label class="form-label">Costo (€, opzionale)</label>
        <input type="number" step="0.01" name="costo" class="input-field" placeholder="0.00">
      </div>
      ${ricorrenzaSelect()}
      <div class="form-group">
        <label class="form-label">Note (opzionale)</label>
        <input type="text" name="note" class="input-field" placeholder="Appunti...">
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          <option value="appuntamento">Appuntamento</option>
          <option value="lavoro">Lavoro</option>
          <option value="personale">Personale</option>
          <option value="sport">Sport</option>
          <option value="altro">Altro</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    const costo = data.costo ? parseFloat(data.costo) : null;
    await db.add('eventi', {
      titolo: data.titolo,
      data: data.data,
      ora: data.ora || null,
      luogo: data.luogo || null,
      tipo: data.tipo,
      costo: costo,
      ricorrenza: data.ricorrenza || null,
      note: data.note || null
    });

    if (costo) {
      await db.add('transazioni', {
        importo: costo, tipo: 'uscita',
        categoria: guessEventCategory(data.titolo),
        descrizione: data.titolo,
        data: new Date(data.data).toISOString()
      });
    }

    loadContent();
  });
}

function openAddScadenza() {
  modal.open('Nuova scadenza', `
    <form>
      <div class="form-group">
        <label class="form-label">Titolo</label>
        <input type="text" name="titolo" class="input-field" placeholder="Es. Rinnovo patente" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Data scadenza</label>
        <input type="date" name="data" class="input-field" required>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="input-field">
          <option value="documento">Documento</option>
          <option value="veicolo">Veicolo</option>
          <option value="casa">Casa</option>
          <option value="salute">Salute</option>
          <option value="abbonamento">Abbonamento</option>
          <option value="altro">Altro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Costo (€, opzionale)</label>
        <input type="number" step="0.01" name="costo" class="input-field" placeholder="0.00">
      </div>
      ${ricorrenzaSelect()}
      <div class="form-group">
        <label class="form-label">Note (opzionale)</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Portare fototessera">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    const costo = data.costo ? parseFloat(data.costo) : null;
    await db.add('scadenze', {
      titolo: data.titolo,
      data: data.data,
      descrizione: data.descrizione || null,
      categoria: data.categoria,
      costo: costo,
      ricorrenza: data.ricorrenza || null,
      completata: false
    });

    if (costo) {
      await db.add('transazioni', {
        importo: costo, tipo: 'uscita',
        categoria: 'Altro',
        descrizione: `Scadenza: ${data.titolo}`,
        data: new Date(data.data).toISOString()
      });
    }

    loadContent();
  });
}

function guessEventCategory(titolo) {
  const norm = titolo.toLowerCase();
  if (/dentista|medico|psicologo|fisioterapista|oculista|visita|ospedale/.test(norm)) return 'Salute';
  if (/palestra|sport|allenamento/.test(norm)) return 'Svago';
  if (/riunione|meeting|ufficio|lavoro/.test(norm)) return 'Altro';
  return 'Altro';
}
