import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on, emit } from '../store.js';

let unsub = null;
let activeTab = 'lista';

const PRODUCT_CATEGORIES = {
  'Frutta e Verdura': ['banana','banane','mela','mele','arancia','arance','limone','limoni','fragola','fragole','pera','pere','uva','anguria','melone','pesca','pesche','pomodoro','pomodori','patata','patate','cipolla','cipolle','aglio','carota','carote','zucchina','zucchine','melanzana','melanzane','peperone','peperoni','insalata','verdura','frutta'],
  'Latticini e Uova': ['latte','formaggio','mozzarella','yogurt','burro','uova','uovo','panna','ricotta','parmigiano','grana'],
  'Carne e Pesce': ['pollo','carne','pesce','tonno','salmone','gamberi','salsiccia','salsicce','hamburger','bacon','pancetta','prosciutto','salame','wurstel','vitello','maiale','manzo','bresaola'],
  'Pane e Pasta': ['pane','pasta','riso','farina','biscotti','biscotto','cereali','pizza','grissini','cracker','piadina'],
  'Bevande': ['acqua','birra','vino','caffe','caffè','te','tè','succo','coca','cola','bottiglia','bottiglie','lattina','lattine','aranciata','limonata'],
  'Dolci e Snack': ['gelato','cioccolato','cioccolata','nutella','marmellata','miele','merendine','patatine','caramelle'],
  'Casa e Igiene': ['detersivo','sapone','shampoo','carta','scottex','fazzoletti','pannolini','tovaglioli','spugna','candeggina','ammorbidente','dentifricio','bagnoschiuma'],
};

function categorizeProduct(name) {
  const norm = name.toLowerCase().trim();
  for (const [cat, words] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const w of words) {
      if (norm === w || norm.includes(w)) return cat;
    }
  }
  return 'Altro';
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Spesa</h1>
        <p id="spesa-subtitle"></p>
      </div>
      <div id="spesa-tabs" style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-md)">
        <button class="spesa-tab active" data-tab="lista" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--accent);color:#fff;border:none">Lista spesa</button>
        <button class="spesa-tab" data-tab="dispensa" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Dispensa</button>
      </div>
      <div id="spesa-content"></div>
    </div>
    <button class="fab" id="spesa-add">+</button>
  `;

  container.querySelectorAll('.spesa-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateTabs(container);
      loadContent();
    });
  });

  document.getElementById('spesa-add').addEventListener('click', () => {
    if (activeTab === 'lista') openAddSpesa();
    else openAddDispensa();
  });

  unsub = on('data-changed', () => loadContent());
  await loadContent();
}

export function destroy() {
  if (unsub) unsub();
}

function updateTabs(container) {
  container.querySelectorAll('.spesa-tab').forEach(btn => {
    if (btn.dataset.tab === activeTab) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.border = '1px solid var(--border-light)';
    }
  });
}

async function loadContent() {
  if (activeTab === 'lista') await loadLista();
  else await loadDispensa();
}

async function loadLista() {
  const items = await db.getAll('spesa');
  const contentEl = document.getElementById('spesa-content');
  const subtitleEl = document.getElementById('spesa-subtitle');
  if (!contentEl) return;

  const daComprare = items.filter(i => !i.completato);
  const completati = items.filter(i => i.completato)
    .sort((a, b) => new Date(b.dataCompletato || 0) - new Date(a.dataCompletato || 0));

  subtitleEl.textContent = daComprare.length > 0
    ? `${daComprare.length} prodott${daComprare.length === 1 ? 'o' : 'i'} da comprare`
    : 'Lista vuota';

  if (items.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛒</div>
        <p>Nessun prodotto nella lista.<br>Aggiungine uno o scrivi in chat!<br><br>Prova: "compra pane, latte e uova"</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = '';

  if (daComprare.length > 0) {
    const grouped = {};
    for (const item of daComprare) {
      const cat = categorizeProduct(item.nome);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    const catOrder = [...Object.keys(PRODUCT_CATEGORIES), 'Altro'];
    const catIcons = {
      'Frutta e Verdura': '🥬', 'Latticini e Uova': '🥛', 'Carne e Pesce': '🥩',
      'Pane e Pasta': '🍞', 'Bevande': '🥤', 'Dolci e Snack': '🍫',
      'Casa e Igiene': '🧴', 'Altro': '📦'
    };

    for (const cat of catOrder) {
      if (!grouped[cat]) continue;
      contentEl.innerHTML += `
        <div class="section-title" style="display:flex;align-items:center;gap:6px">
          <span>${catIcons[cat] || '📦'}</span> ${cat} (${grouped[cat].length})
        </div>
      `;
      contentEl.innerHTML += grouped[cat].map(i => spesaItemHTML(i)).join('');
    }
  }

  if (completati.length > 0) {
    contentEl.innerHTML += `
      <div style="margin-top:var(--space-md);display:flex;justify-content:space-between;align-items:center">
        <div class="section-title" style="margin:0">Completati (${completati.length})</div>
        <button id="clear-completati" class="btn btn-ghost" style="font-size:var(--font-xs);padding:4px 8px;color:var(--danger)">Svuota</button>
      </div>
    `;
    contentEl.innerHTML += completati.slice(0, 10).map(i => spesaItemHTML(i)).join('');
  }

  bindListaListeners(contentEl);
}

function spesaItemHTML(item) {
  const qtyText = item.quantita ? `${item.quantita}${item.unita ? ' ' + item.unita : ''}` : '';
  return `
    <div class="list-item ${item.completato ? 'checked' : ''}" data-id="${item.id}" style="padding:16px var(--space-md)">
      <div class="check" data-id="${item.id}"></div>
      <div class="item-text">
        <div class="item-title" style="font-size:var(--font-md)">${item.nome}</div>
        ${qtyText ? `<div class="item-subtitle">${qtyText}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-icon delete-btn" data-id="${item.id}" style="font-size:14px;color:var(--text-muted);width:32px;height:32px">✕</button>
    </div>
  `;
}

function bindListaListeners(container) {
  container.querySelectorAll('.check').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.id);
      const item = await db.get('spesa', id);
      if (!item) return;

      item.completato = !item.completato;
      item.dataCompletato = item.completato ? new Date().toISOString() : null;
      await db.put('spesa', item);

      if (item.completato) {
        await autoAddToDispensa(item.nome, item.quantita);
      }

      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  container.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.del('spesa', Number(el.dataset.id));
      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  const clearBtn = container.querySelector('#clear-completati');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const items = await db.getAll('spesa');
      for (const i of items.filter(x => x.completato)) {
        await db.del('spesa', i.id);
      }
      loadContent();
    });
  }
}

async function autoAddToDispensa(nome, quantita) {
  const items = await db.getAll('dispensa');
  const norm = nome.toLowerCase();
  const found = items.find(i => {
    const a = i.nome.toLowerCase();
    if (a === norm) return true;
    const rootA = a.replace(/[ei]$/, '').replace(/he$/, '');
    const rootB = norm.replace(/[ei]$/, '').replace(/he$/, '');
    return rootA.length >= 3 && rootA === rootB;
  });

  if (found) {
    found.ultimoAcquisto = new Date().toISOString();
    if (quantita) found.quantita = (found.quantita || 0) + parseFloat(quantita);
    else if (found.quantita === 0) found.quantita = 1;
    await db.put('dispensa', found);
  } else {
    await db.add('dispensa', {
      nome,
      quantita: quantita ? parseFloat(quantita) : 1,
      unita: null,
      ultimoAcquisto: new Date().toISOString(),
      consumoMedio: null,
      stimaEsaurimento: null
    });
  }
}

async function loadDispensa() {
  const items = await db.getAll('dispensa');
  const contentEl = document.getElementById('spesa-content');
  const subtitleEl = document.getElementById('spesa-subtitle');
  if (!contentEl) return;

  subtitleEl.textContent = `${items.length} prodott${items.length === 1 ? 'o' : 'i'} in casa`;

  if (items.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏠</div>
        <p>La dispensa è vuota.<br>Racconta i tuoi acquisti in chat o completa prodotti dalla lista!</p>
      </div>
    `;
    return;
  }

  const terminati = items.filter(i => i.quantita !== null && i.quantita <= 0);
  const quasiFiniti = items.filter(i => i.quantita !== null && i.quantita > 0 && i.quantita <= 1);
  const disponibili = items.filter(i => i.quantita === null || i.quantita > 1);

  contentEl.innerHTML = '';

  if (terminati.length > 0) {
    contentEl.innerHTML += `<div class="section-title" style="color:var(--danger)">Terminati (${terminati.length})</div>`;
    contentEl.innerHTML += terminati.map(i => dispensaItemHTML(i, 'danger')).join('');
  }

  if (quasiFiniti.length > 0) {
    contentEl.innerHTML += `<div class="section-title" style="color:var(--warning)">Quasi finiti (${quasiFiniti.length})</div>`;
    contentEl.innerHTML += quasiFiniti.map(i => dispensaItemHTML(i, 'warning')).join('');
  }

  if (disponibili.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Disponibili (${disponibili.length})</div>`;
    contentEl.innerHTML += disponibili.map(i => dispensaItemHTML(i, 'ok')).join('');
  }

  bindDispensaListeners(contentEl);
}

function dispensaItemHTML(item, status) {
  const statusColors = { danger: 'var(--danger)', warning: 'var(--warning)', ok: 'var(--success)' };
  const statusBg = { danger: 'var(--danger-soft)', warning: 'var(--warning-soft)', ok: 'var(--success-soft)' };
  const statusIcons = { danger: '✕', warning: '!', ok: '✓' };
  const qtyText = item.quantita !== null && item.quantita !== undefined
    ? `${item.quantita}${item.unita ? ' ' + item.unita : ''}`
    : '—';
  const lastBuy = item.ultimoAcquisto
    ? new Date(item.ultimoAcquisto).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '';

  return `
    <div class="list-item" data-id="${item.id}" style="padding:14px var(--space-md)">
      <div style="width:36px;height:36px;border-radius:10px;background:${statusBg[status]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${statusColors[status]};flex-shrink:0">${statusIcons[status]}</div>
      <div class="item-text">
        <div class="item-title">${item.nome}</div>
        <div class="item-subtitle">${qtyText}${lastBuy ? ' · comprato ' + lastBuy : ''}</div>
      </div>
      <div style="display:flex;gap:4px">
        ${status === 'danger' ? `<button class="btn-tag btn-tag-add" data-id="${item.id}" title="Aggiungi alla spesa">🛒</button>` : ''}
        ${status !== 'danger' ? `<button class="btn-tag btn-tag-finish" data-id="${item.id}" title="Segna come finito">✕</button>` : ''}
        <button class="btn-tag btn-tag-edit" data-id="${item.id}" title="Modifica">✎</button>
      </div>
    </div>
  `;
}

function bindDispensaListeners(container) {
  container.querySelectorAll('.btn-tag-add').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('dispensa', Number(el.dataset.id));
      if (!item) return;
      await db.add('spesa', {
        nome: item.nome, quantita: null, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      emit('data-changed', { source: 'dispensa' });
      loadContent();
    });
  });

  container.querySelectorAll('.btn-tag-finish').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('dispensa', Number(el.dataset.id));
      if (!item) return;
      item.quantita = 0;
      await db.put('dispensa', item);
      await db.add('spesa', {
        nome: item.nome, quantita: null, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      emit('data-changed', { source: 'dispensa' });
      loadContent();
    });
  });

  container.querySelectorAll('.btn-tag-edit').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      editDispensaItem(Number(el.dataset.id));
    });
  });
}

async function editDispensaItem(id) {
  const item = await db.get('dispensa', id);
  if (!item) return;

  modal.open('Modifica prodotto', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" value="${item.nome}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Quantita</label>
        <input type="text" name="quantita" class="input-field" value="${item.quantita || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Unita (es. kg, litri, pezzi)</label>
        <input type="text" name="unita" class="input-field" value="${item.unita || ''}">
      </div>
      <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
        <button type="submit" class="btn btn-primary" style="flex:1">Salva</button>
        <button type="button" id="del-dispensa" class="btn btn-ghost" style="color:var(--danger)">Elimina</button>
      </div>
    </form>
  `, async (data) => {
    item.nome = data.nome;
    item.quantita = data.quantita ? parseFloat(data.quantita) : null;
    item.unita = data.unita || null;
    await db.put('dispensa', item);
    emit('data-changed', { source: 'dispensa' });
    loadContent();
  });

  setTimeout(() => {
    const delBtn = document.getElementById('del-dispensa');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        await db.del('dispensa', id);
        modal.close();
        emit('data-changed', { source: 'dispensa' });
        loadContent();
      });
    }
  }, 100);
}

function openAddSpesa() {
  modal.open('Aggiungi alla spesa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Latte" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantita (opzionale)</label>
        <input type="text" name="quantita" class="input-field" placeholder="Es. 2">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    const items = data.nome.split(/\s*,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s.length > 0);
    for (const nome of items) {
      await db.add('spesa', {
        nome,
        quantita: items.length === 1 && data.quantita ? parseFloat(data.quantita) : null,
        unita: null,
        completato: false,
        dataAggiunta: new Date().toISOString(),
        dataCompletato: null
      });
    }
    emit('data-changed', { source: 'spesa' });
    loadContent();
  });
}

function openAddDispensa() {
  modal.open('Aggiungi alla dispensa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Riso" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantita</label>
        <input type="text" name="quantita" class="input-field" placeholder="Es. 2">
      </div>
      <div class="form-group">
        <label class="form-label">Unita (es. kg, litri, pezzi)</label>
        <input type="text" name="unita" class="input-field" placeholder="Es. kg">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    await db.add('dispensa', {
      nome: data.nome,
      quantita: data.quantita ? parseFloat(data.quantita) : null,
      unita: data.unita || null,
      ultimoAcquisto: new Date().toISOString(),
      consumoMedio: null,
      stimaEsaurimento: null
    });
    emit('data-changed', { source: 'dispensa' });
    loadContent();
  });
}
