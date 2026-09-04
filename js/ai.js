import * as db from './db.js';

export async function isAvailable() {
  const url = await getUrl();
  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getUrl() {
  return await db.getSetting('ollama_url') || 'http://localhost:11434';
}

export async function getModels() {
  const url = await getUrl();
  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

export async function chat(userMessage) {
  const url = await getUrl();
  const model = await db.getSetting('ollama_model') || 'llama3.2';

  const systemPrompt = `Sei NODO, un assistente personale italiano. L'utente ti racconta la sua giornata e tu devi estrarre azioni strutturate.

Rispondi SEMPRE in JSON con questo formato:
{
  "response": "risposta breve e amichevole in italiano",
  "actions": [
    { "type": "spesa_add", "item": "nome prodotto" },
    { "type": "spesa_done", "item": "nome prodotto" },
    { "type": "transazione", "importo": 42, "categoria": "Alimentazione", "descrizione": "supermercato" },
    { "type": "dispensa_add", "item": "nome prodotto", "quantita": 2, "unita": "kg" },
    { "type": "dispensa_update", "item": "nome prodotto", "quantita": 0 }
  ]
}

Categorie valide per le transazioni: Alimentazione, Casa, Trasporti, Svago, Salute, Abbonamenti, Altro.

Se non ci sono azioni da fare, rispondi comunque con "actions": [].`;

  try {
    const resp = await fetch(url + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        format: 'json'
      })
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const content = data.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch {
    return null;
  }
}
