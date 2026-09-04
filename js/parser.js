import * as db from './db.js';

const CATEGORY_MAP = {
  'supermercato': 'Alimentazione', 'market': 'Alimentazione', 'alimentari': 'Alimentazione',
  'coop': 'Alimentazione', 'esselunga': 'Alimentazione', 'lidl': 'Alimentazione', 'eurospin': 'Alimentazione',
  'conad': 'Alimentazione', 'carrefour': 'Alimentazione', 'aldi': 'Alimentazione',
  'pranzo': 'Alimentazione', 'cena': 'Alimentazione', 'colazione': 'Alimentazione',
  'ristorante': 'Alimentazione', 'pizzeria': 'Alimentazione', 'bar': 'Alimentazione',
  'benzina': 'Trasporti', 'treno': 'Trasporti', 'autobus': 'Trasporti', 'metro': 'Trasporti',
  'taxi': 'Trasporti', 'uber': 'Trasporti', 'parcheggio': 'Trasporti', 'autostrada': 'Trasporti',
  'affitto': 'Casa', 'bolletta': 'Casa', 'luce': 'Casa', 'gas': 'Casa', 'acqua': 'Casa',
  'netflix': 'Abbonamenti', 'spotify': 'Abbonamenti', 'abbonamento': 'Abbonamenti',
  'palestra': 'Salute', 'farmacia': 'Salute', 'medico': 'Salute', 'dentista': 'Salute',
  'cinema': 'Svago', 'concerto': 'Svago', 'teatro': 'Svago', 'gioco': 'Svago',
};

function normalize(text) {
  return text.toLowerCase()
    .replace(/[àáâã]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõ]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .trim();
}

function extractAmount(text) {
  const patterns = [
    /(\d+[.,]?\d*)\s*(?:euro|€)/i,
    /(?:euro|€)\s*(\d+[.,]?\d*)/i,
    /speso\s+(\d+[.,]?\d*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

function extractProducts(text) {
  const cleaned = text
    .replace(/\d+[.,]?\d*\s*(?:euro|€)/gi, '')
    .replace(/(?:euro|€)\s*\d+[.,]?\d*/gi, '')
    .replace(/ho (?:comprato|preso|acquistato)/gi, '')
    .replace(/(?:al|dal|per il|per la|per|dal|dalla|al|alla|allo)\s+\w+$/gi, '')
    .trim();

  const items = cleaned
    .split(/\s*[,e]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 40);

  return items;
}

function guessCategory(text) {
  const norm = normalize(text);
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (norm.includes(keyword)) return cat;
  }
  return 'Altro';
}

const PATTERNS = [
  {
    name: 'acquisto_con_spesa',
    match: /ho (?:comprato|preso|acquistato)\s+(.+?)(?:\.\s*|\s+)ho speso\s+(\d+[.,]?\d*)\s*(?:euro|€)/i,
    async handler(m) {
      const products = extractProducts(m[1]);
      const amount = parseFloat(m[2].replace(',', '.'));
      const actions = [];
      const responses = [];

      for (const p of products) {
        await db.add('spesa', { nome: p, quantita: null, unita: null, completato: true, dataAggiunta: new Date().toISOString(), dataCompletato: new Date().toISOString() });
        await addOrUpdateDispensa(p, null);
        actions.push({ type: 'spesa', item: p });
      }

      await db.add('transazioni', { importo: amount, tipo: 'uscita', categoria: 'Alimentazione', descrizione: `Acquisto: ${products.join(', ')}`, data: new Date().toISOString() });
      actions.push({ type: 'transazione', amount });

      responses.push(`Ho registrato ${products.join(', ')} nella spesa e dispensa.`);
      responses.push(`Spesa di €${amount.toFixed(2)} registrata.`);

      return { actions, response: responses.join(' ') };
    }
  },
  {
    name: 'acquisto',
    match: /ho (?:comprato|preso|acquistato)\s+(.+)/i,
    async handler(m) {
      const fullText = m[1];
      const products = extractProducts(fullText);
      const amount = extractAmount(fullText);
      const actions = [];
      const responses = [];

      for (const p of products) {
        await db.add('spesa', { nome: p, quantita: null, unita: null, completato: true, dataAggiunta: new Date().toISOString(), dataCompletato: new Date().toISOString() });
        await addOrUpdateDispensa(p, null);
        actions.push({ type: 'spesa', item: p });
      }

      if (products.length > 0) {
        responses.push(`Ho registrato: ${products.join(', ')}.`);
      }

      if (amount) {
        await db.add('transazioni', { importo: amount, tipo: 'uscita', categoria: guessCategory(fullText), descrizione: `Acquisto: ${products.join(', ')}`, data: new Date().toISOString() });
        actions.push({ type: 'transazione', amount });
        responses.push(`Spesa di €${amount.toFixed(2)} registrata.`);
      }

      return { actions, response: responses.join(' ') || 'Ho capito, ma non ho trovato prodotti specifici.' };
    }
  },
  {
    name: 'spesa_importo',
    match: /ho speso\s+(\d+[.,]?\d*)\s*(?:euro|€)?(.*)$/i,
    async handler(m) {
      const amount = parseFloat(m[1].replace(',', '.'));
      const context = m[2] ? m[2].trim() : '';
      const category = guessCategory(context);
      const desc = context.replace(/^(?:per|al|alla|dal|dalla|allo|in)\s+/i, '').trim();

      await db.add('transazioni', {
        importo: amount, tipo: 'uscita',
        categoria: category,
        descrizione: desc || null,
        data: new Date().toISOString()
      });

      return {
        actions: [{ type: 'transazione', amount, category }],
        response: `Registrato: €${amount.toFixed(2)} in ${category}${desc ? ` (${desc})` : ''}.`
      };
    }
  },
  {
    name: 'aggiungi_spesa',
    match: /(?:compra|devo comprare|aggiungi|metti|serve)\s+(.+?)(?:\s+alla\s+(?:lista|spesa))?$/i,
    async handler(m) {
      const products = m[1].split(/\s*[,e]\s+/).map(s => s.trim()).filter(s => s.length > 1);
      for (const p of products) {
        await db.add('spesa', { nome: p, quantita: null, unita: null, completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null });
      }
      return {
        actions: products.map(p => ({ type: 'spesa_add', item: p })),
        response: `Aggiunto alla spesa: ${products.join(', ')}.`
      };
    }
  },
  {
    name: 'finito',
    match: /(?:ho finito|e' finit[oa]|è finit[oa]|finit[oa]|non ho piu'?|non ho più)\s+(?:il |la |lo |l'|le |i |gli )?(.+)/i,
    async handler(m) {
      const product = m[1].trim();
      const items = await db.getAll('dispensa');
      const found = items.find(i => normalize(i.nome) === normalize(product));
      if (found) {
        found.quantita = 0;
        await db.put('dispensa', found);
      }
      await db.add('spesa', { nome: product, quantita: null, unita: null, completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null });
      return {
        actions: [{ type: 'dispensa_update', item: product }, { type: 'spesa_add', item: product }],
        response: `${product} segnato come terminato e aggiunto alla lista della spesa.`
      };
    }
  },
  {
    name: 'guadagno',
    match: /(?:ho (?:guadagnato|ricevuto|incassato))\s+(\d+[.,]?\d*)\s*(?:euro|€)?(.*)$/i,
    async handler(m) {
      const amount = parseFloat(m[1].replace(',', '.'));
      const context = m[2] ? m[2].trim() : '';
      const desc = context.replace(/^(?:per|da|di|con)\s+/i, '').trim();

      await db.add('transazioni', {
        importo: amount, tipo: 'entrata',
        categoria: 'Altro',
        descrizione: desc || null,
        data: new Date().toISOString()
      });

      return {
        actions: [{ type: 'transazione', amount, tipo: 'entrata' }],
        response: `Entrata di €${amount.toFixed(2)} registrata${desc ? ` (${desc})` : ''}.`
      };
    }
  },
  {
    name: 'quanto_speso',
    match: /(?:quanto ho speso|quanto sto spendendo|totale spese|riepilogo spese)(?:\s+(?:questo|a|in|di)\s+(\w+))?/i,
    async handler(m) {
      const all = await db.getAll('transazioni');
      const now = new Date();
      const meseCorrente = all.filter(t => {
        const d = new Date(t.data);
        return t.tipo === 'uscita' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const totale = meseCorrente.reduce((s, t) => s + t.importo, 0);

      const perCategoria = {};
      for (const t of meseCorrente) {
        const cat = t.categoria || 'Altro';
        perCategoria[cat] = (perCategoria[cat] || 0) + t.importo;
      }

      const dettaglio = Object.entries(perCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, tot]) => `${cat}: €${tot.toFixed(2)}`)
        .join(', ');

      const mese = now.toLocaleDateString('it-IT', { month: 'long' });
      return {
        actions: [],
        response: `A ${mese} hai speso €${totale.toFixed(2)}. ${dettaglio ? `Dettaglio: ${dettaglio}.` : ''}`
      };
    }
  },
  {
    name: 'cosa_in_dispensa',
    match: /(?:cosa ho|che cosa ho|cosa c'e'|cosa c'è|cosa abbiamo)(?:\s+in)?\s*(?:casa|dispensa|frigo|frigorifero|cucina)/i,
    async handler() {
      const items = await db.getAll('dispensa');
      if (items.length === 0) {
        return { actions: [], response: 'La dispensa è vuota. Racconta i tuoi acquisti e la riempio io!' };
      }
      const list = items.map(i => {
        const q = i.quantita;
        const status = q === 0 ? ' (terminato)' : q !== null && q <= 1 ? ' (quasi finito)' : '';
        return `${i.nome}${status}`;
      }).join(', ');
      return { actions: [], response: `In dispensa hai: ${list}.` };
    }
  },
  {
    name: 'cosa_comprare',
    match: /(?:cosa devo|che cosa devo|che devo)\s*(?:comprare|prendere)|(?:lista della spesa|mostra(?:mi)?\s+(?:la\s+)?spesa)/i,
    async handler() {
      const items = await db.getAll('spesa');
      const daComprare = items.filter(i => !i.completato);
      if (daComprare.length === 0) {
        return { actions: [], response: 'La lista della spesa è vuota. Tutto a posto!' };
      }
      const list = daComprare.map(i => i.nome).join(', ');
      return { actions: [], response: `Da comprare: ${list} (${daComprare.length} prodotti).` };
    }
  },
  {
    name: 'mangiato',
    match: /(?:ho mangiato|a pranzo|a cena|a colazione|per pranzo|per cena|per colazione)\s+(.+)/i,
    async handler(m) {
      const food = m[1].replace(/ho (?:mangiato|preso)\s*/i, '').trim();
      return {
        actions: [{ type: 'alimentazione', item: food }],
        response: `Ho annotato: ${food}. (La sezione alimentazione sarà disponibile presto!)`
      };
    }
  },
];

async function addOrUpdateDispensa(nome, quantita) {
  const items = await db.getAll('dispensa');
  const found = items.find(i => normalize(i.nome) === normalize(nome));
  if (found) {
    found.ultimoAcquisto = new Date().toISOString();
    if (quantita !== null) found.quantita = (found.quantita || 0) + quantita;
    await db.put('dispensa', found);
  } else {
    await db.add('dispensa', {
      nome,
      quantita: quantita,
      unita: null,
      ultimoAcquisto: new Date().toISOString(),
      consumoMedio: null,
      stimaEsaurimento: null
    });
  }
}

export async function parseMessage(text) {
  const norm = normalize(text);

  for (const pattern of PATTERNS) {
    const m = norm.match(pattern.match) || text.match(pattern.match);
    if (m) {
      return pattern.handler(m);
    }
  }

  return {
    actions: [],
    response: 'Ho capito, ma non ho riconosciuto un\'azione specifica. Prova con frasi come "ho comprato...", "ho speso...", "compra...".'
  };
}
