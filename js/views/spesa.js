import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on } from '../store.js';

let unsub = null;

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Spesa</h1>
        <p>La tua lista della spesa</p>
      </div>
      <div id="spesa-list"></div>
    </div>
    <button class="fab" id="spesa-add">+</button>
  `;

  document.getElementById('spesa-add').addEventListener('click', openAddModal);
  unsub = on('data-changed', () => loadList());
  await loadList();
}

export function destroy() {
  if (unsub) unsub();
}

async function loadList() {
  const items = await db.getAll('spesa');
  const listEl = document.getElementById('spesa-list');
  if (!listEl) return;

  const daComprare = items.filter(i => !i.completato);
  const completati = items.filter(i => i.completato);

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛒</div>
        <p>Nessun prodotto nella lista.<br>Aggiungine uno o scrivi in chat!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  if (daComprare.length > 0) {
    listEl.innerHTML += `<div class="section-title">Da comprare (${daComprare.length})</div>`;
    listEl.innerHTML += daComprare.map(i => itemHTML(i)).join('');
  }

  if (completati.length > 0) {
    listEl.innerHTML += `<div class="section-title">Completati</div>`;
    listEl.innerHTML += completati.map(i => itemHTML(i)).join('');
  }

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => toggleItem(Number(el.dataset.id)));
  });

  listEl.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(Number(el.dataset.id));
    });
  });
}

function itemHTML(item) {
  return `
    <div class="list-item ${item.completato ? 'checked' : ''}" data-id="${item.id}">
      <div class="check"></div>
      <div class="item-text">
        <div class="item-title">${item.nome}</div>
        ${item.quantita ? `<div class="item-subtitle">${item.quantita}${item.unita ? ' ' + item.unita : ''}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-icon delete-btn" data-id="${item.id}" style="font-size:16px;color:var(--text-muted)">✕</button>
    </div>
  `;
}

async function toggleItem(id) {
  const item = await db.get('spesa', id);
  if (!item) return;
  item.completato = !item.completato;
  if (item.completato) item.dataCompletato = new Date().toISOString();
  await db.put('spesa', item);
  loadList();
}

async function deleteItem(id) {
  await db.del('spesa', id);
  loadList();
}

function openAddModal() {
  modal.open('Aggiungi alla spesa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Latte" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità (opzionale)</label>
        <input type="text" name="quantita" class="input-field" placeholder="Es. 2">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    await db.add('spesa', {
      nome: data.nome,
      quantita: data.quantita || null,
      unita: null,
      completato: false,
      dataAggiunta: new Date().toISOString(),
      dataCompletato: null
    });
    loadList();
  });
}
