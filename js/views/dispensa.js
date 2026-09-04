import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on } from '../store.js';

let unsub = null;

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Dispensa</h1>
        <p>Cosa hai in casa</p>
      </div>
      <div id="dispensa-list"></div>
    </div>
    <button class="fab" id="dispensa-add">+</button>
  `;

  document.getElementById('dispensa-add').addEventListener('click', openAddModal);
  unsub = on('data-changed', () => loadList());
  await loadList();
}

export function destroy() {
  if (unsub) unsub();
}

async function loadList() {
  const items = await db.getAll('dispensa');
  const listEl = document.getElementById('dispensa-list');
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏠</div>
        <p>La dispensa è vuota.<br>Aggiungi prodotti o racconta i tuoi acquisti in chat!</p>
      </div>
    `;
    return;
  }

  items.sort((a, b) => (a.quantita || 0) - (b.quantita || 0));

  listEl.innerHTML = items.map(item => {
    const status = getStatus(item);
    return `
      <div class="list-item" data-id="${item.id}">
        <div style="font-size:20px">${status.icon}</div>
        <div class="item-text">
          <div class="item-title">${item.nome}</div>
          <div class="item-subtitle">${formatQuantity(item)} · ${status.label}</div>
        </div>
        <button class="btn btn-ghost btn-icon delete-btn" data-id="${item.id}" style="font-size:16px;color:var(--text-muted)">✕</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      editItem(Number(el.dataset.id));
    });
  });

  listEl.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(Number(el.dataset.id));
    });
  });
}

function getStatus(item) {
  const q = item.quantita || 0;
  if (q <= 0) return { icon: '🔴', label: 'Terminato' };
  if (q <= 1) return { icon: '🟡', label: 'Quasi finito' };
  return { icon: '🟢', label: 'Disponibile' };
}

function formatQuantity(item) {
  if (!item.quantita && item.quantita !== 0) return 'Quantità non specificata';
  return `${item.quantita}${item.unita ? ' ' + item.unita : ''}`;
}

async function editItem(id) {
  const item = await db.get('dispensa', id);
  if (!item) return;

  modal.open('Modifica prodotto', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" value="${item.nome}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità</label>
        <input type="text" name="quantita" class="input-field" value="${item.quantita || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Unità (es. kg, litri, pezzi)</label>
        <input type="text" name="unita" class="input-field" value="${item.unita || ''}">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    item.nome = data.nome;
    item.quantita = data.quantita ? parseFloat(data.quantita) : null;
    item.unita = data.unita || null;
    await db.put('dispensa', item);
    loadList();
  });
}

async function deleteItem(id) {
  await db.del('dispensa', id);
  loadList();
}

function openAddModal() {
  modal.open('Aggiungi alla dispensa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Riso" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità</label>
        <input type="text" name="quantita" class="input-field" placeholder="Es. 2">
      </div>
      <div class="form-group">
        <label class="form-label">Unità (es. kg, litri, pezzi)</label>
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
    loadList();
  });
}
