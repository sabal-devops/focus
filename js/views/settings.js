import * as db from '../db.js';

export async function render(container) {
  const ollamaUrl = await db.getSetting('ollama_url') || 'http://localhost:11434';

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Impostazioni</h1>
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
        <button id="clear-data" class="btn btn-ghost" style="width:100%;justify-content:flex-start;color:var(--danger)">
          🗑 Cancella tutti i dati
        </button>
      </div>

      <div class="section-title">Info</div>
      <div class="card">
        <div class="item-subtitle">NODO v0.1.0 — MVP</div>
        <div class="item-subtitle" style="margin-top:4px">Hub personale intelligente</div>
      </div>
    </div>
  `;

  document.getElementById('ollama-url').addEventListener('change', async (e) => {
    await db.setSetting('ollama_url', e.target.value.trim());
  });

  document.getElementById('test-ollama').addEventListener('click', testOllama);
  document.getElementById('export-data').addEventListener('click', exportData);
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
  const data = {
    messages: await db.getAll('messages'),
    spesa: await db.getAll('spesa'),
    dispensa: await db.getAll('dispensa'),
    transazioni: await db.getAll('transazioni'),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nodo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearAllData() {
  if (!confirm('Sei sicuro? Tutti i dati verranno cancellati permanentemente.')) return;
  if (!confirm('Conferma: cancellare TUTTO?')) return;
  await db.clear('messages');
  await db.clear('spesa');
  await db.clear('dispensa');
  await db.clear('transazioni');
  alert('Dati cancellati.');
  window.location.reload();
}
