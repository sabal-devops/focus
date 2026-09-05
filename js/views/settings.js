import * as db from '../db.js';

const ALL_STORES = ['messages', 'spesa', 'dispensa', 'transazioni', 'eventi', 'scadenze', 'impostazioni'];

export async function render(container) {
  const ollamaUrl = await db.getSetting('ollama_url') || 'http://localhost:11434';
  const sogliaSettimanale = await db.getSetting('soglia_settimanale') || '';
  const sogliaMensile = await db.getSetting('soglia_mensile') || '';

  const currentTheme = localStorage.getItem('focus_theme') || 'auto';

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Impostazioni</h1>
      </div>

      <div class="section-title">Aspetto</div>
      <div class="card">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Tema</label>
          <div id="theme-btns" style="display:flex;gap:var(--space-xs)">
            <button class="theme-btn${currentTheme === 'auto' ? ' active' : ''}" data-theme="auto" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;border:1px solid var(--border-light)">Auto</button>
            <button class="theme-btn${currentTheme === 'light' ? ' active' : ''}" data-theme="light" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;border:1px solid var(--border-light)">Chiaro</button>
            <button class="theme-btn${currentTheme === 'dark' ? ' active' : ''}" data-theme="dark" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;border:1px solid var(--border-light)">Scuro</button>
          </div>
        </div>
      </div>

      <div class="section-title">Notifiche</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Permesso notifiche</label>
          <div style="display:flex;align-items:center;gap:var(--space-sm)">
            <button id="notif-perm" class="btn btn-primary" style="flex:1">Attiva notifiche</button>
            <span id="notif-status" style="font-size:var(--font-sm)"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Soglia settimanale (€)</label>
          <input type="number" id="soglia-week" class="input-field" value="${sogliaSettimanale}" placeholder="Es. 100">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Soglia mensile (€)</label>
          <input type="number" id="soglia-month" class="input-field" value="${sogliaMensile}" placeholder="Es. 400">
        </div>
      </div>

      <div class="section-title">Connessione AI</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">URL Ollama</label>
          <input type="text" id="ollama-url" class="input-field" value="${ollamaUrl}" placeholder="http://localhost:11434">
        </div>
        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <button id="test-ollama" class="btn btn-primary" style="flex:1">Testa connessione</button>
          <span id="ollama-status"></span>
        </div>
      </div>

      <div class="section-title">Dati</div>
      <div class="card">
        <button id="export-data" class="btn btn-ghost" style="width:100%;justify-content:flex-start">
          📤 Esporta tutti i dati (JSON)
        </button>
      </div>
      <div class="card">
        <button id="import-data" class="btn btn-ghost" style="width:100%;justify-content:flex-start">
          📥 Importa dati da backup
        </button>
        <input type="file" id="import-file" accept=".json" style="display:none">
      </div>
      <div class="card">
        <button id="clear-data" class="btn btn-ghost" style="width:100%;justify-content:flex-start;color:var(--danger)">
          🗑 Cancella tutti i dati
        </button>
      </div>

      <div class="section-title">Info</div>
      <div class="card">
        <div class="item-subtitle">Focus v1.0.0</div>
        <div class="item-subtitle" style="margin-top:4px">Il tuo hub personale intelligente</div>
      </div>
    </div>
  `;

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      localStorage.setItem('focus_theme', theme);
      if (theme === 'auto') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === theme);
        b.style.background = b.dataset.theme === theme ? 'var(--accent)' : '';
        b.style.color = b.dataset.theme === theme ? '#fff' : '';
      });
    });
    if (btn.classList.contains('active')) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
    }
  });

  const notifBtn = document.getElementById('notif-perm');
  const notifStatus = document.getElementById('notif-status');
  function updateNotifUI() {
    if (!('Notification' in window)) {
      notifBtn.style.display = 'none';
      notifStatus.textContent = 'Non supportate';
      notifStatus.style.color = 'var(--text-muted)';
    } else if (Notification.permission === 'granted') {
      notifBtn.textContent = 'Attive';
      notifBtn.disabled = true;
      notifBtn.style.opacity = '0.6';
      notifStatus.textContent = '✓';
      notifStatus.style.color = 'var(--success)';
    } else if (Notification.permission === 'denied') {
      notifBtn.textContent = 'Bloccate';
      notifBtn.disabled = true;
      notifBtn.style.opacity = '0.6';
      notifStatus.textContent = 'Vai in Impostazioni > Safari per abilitare';
      notifStatus.style.color = 'var(--danger)';
    }
  }
  updateNotifUI();
  notifBtn.addEventListener('click', async () => {
    const result = await Notification.requestPermission();
    updateNotifUI();
    if (result === 'granted') {
      const { checkAndNotify } = await import('../notifications.js?v=17');
      checkAndNotify();
    }
  });

  document.getElementById('soglia-week').addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value);
    await db.setSetting('soglia_settimanale', val > 0 ? val : null);
  });

  document.getElementById('soglia-month').addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value);
    await db.setSetting('soglia_mensile', val > 0 ? val : null);
  });

  document.getElementById('ollama-url').addEventListener('change', async (e) => {
    await db.setSetting('ollama_url', e.target.value.trim());
  });

  document.getElementById('test-ollama').addEventListener('click', testOllama);
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('clear-data').addEventListener('click', clearAllData);
}

async function testOllama() {
  const statusEl = document.getElementById('ollama-status');
  const url = document.getElementById('ollama-url').value.trim();
  statusEl.innerHTML = '<span style="color:var(--text-muted)">Connessione...</span>';

  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      const models = data.models || [];
      statusEl.innerHTML = `<span class="badge badge-success">Connesso · ${models.length} modelli</span>`;
    } else {
      statusEl.innerHTML = '<span class="badge badge-danger">Errore risposta</span>';
    }
  } catch {
    statusEl.innerHTML = '<span class="badge badge-danger">Non raggiungibile</span>';
  }
}

async function exportData() {
  const data = { exportedAt: new Date().toISOString(), version: 2 };
  for (const store of ALL_STORES) {
    data[store] = await db.getAll(store);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const stores = ALL_STORES.filter(s => Array.isArray(data[s]) && data[s].length > 0);
    if (stores.length === 0) {
      alert('Il file non contiene dati validi.');
      return;
    }

    const count = stores.reduce((sum, s) => sum + data[s].length, 0);
    if (!confirm(`Importare ${count} elementi da ${stores.length} sezioni?\n(${stores.join(', ')})\n\nI dati esistenti verranno mantenuti.`)) return;

    let imported = 0;
    for (const store of stores) {
      for (const item of data[store]) {
        delete item.id;
        await db.add(store, item);
        imported++;
      }
    }

    alert(`Importati ${imported} elementi con successo.`);
    window.location.reload();
  } catch (err) {
    alert('Errore durante l\'importazione: ' + err.message);
  }

  e.target.value = '';
}

async function clearAllData() {
  if (!confirm('Sei sicuro? Tutti i dati verranno cancellati permanentemente.')) return;
  if (!confirm('Conferma: cancellare TUTTO?')) return;
  for (const store of ALL_STORES) {
    await db.clear(store);
  }
  alert('Dati cancellati.');
  window.location.reload();
}
