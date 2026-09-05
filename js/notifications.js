import * as db from './db.js';
import { show as toast } from './components/toast.js';
import { emit } from './store.js';

const NOTIFIED_KEY = 'focus_notified';

function getNotified() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}');
  } catch { return {}; }
}

function markNotified(key) {
  const n = getNotified();
  n[key] = Date.now();
  const cutoff = Date.now() - 7 * 86400000;
  for (const k of Object.keys(n)) {
    if (n[k] < cutoff) delete n[k];
  }
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(n)); } catch {}
}

function wasNotified(key) {
  return !!getNotified()[key];
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

function expandRecurringDates(event, today, dayAfter) {
  const dates = [new Date(event.data)];
  if (!event.ricorrenza) return dates;

  let current = new Date(event.data);
  for (let i = 0; i < 52; i++) {
    current = nextOccurrence(current, event.ricorrenza);
    if (current > dayAfter) break;
    dates.push(new Date(current));
  }
  return dates;
}

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function checkAndNotify() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  await checkEvents(today, tomorrow, dayAfter);
  await checkDeadlines(today);
  await checkDispensa();
  await checkSpending(today);
}

export async function checkOnDataChange(source) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (source === 'spesa' || source === 'dispensa' || source === 'chat') {
    await checkDispensa();
  }
  if (source === 'transazione' || source === 'chat') {
    await checkSpending(today);
  }
}

async function checkEvents(today, tomorrow, dayAfter) {
  const eventi = await db.getAll('eventi');
  for (const e of eventi) {
    const dates = expandRecurringDates(e, today, dayAfter);
    for (const d of dates) {
      d.setHours(0, 0, 0, 0);
      const dateKey = d.toISOString().slice(0, 10);
      const key = `evento_${e.id}_${dateKey}`;

      if (d.getTime() === today.getTime() && !wasNotified(key)) {
        notify('Evento oggi', `${e.titolo}${e.ora ? ' alle ' + e.ora : ''}${e.costo ? ' — €' + e.costo.toFixed(2) : ''}`);
        markNotified(key);
      } else if (d.getTime() === tomorrow.getTime() && !wasNotified(key + '_tomorrow')) {
        notify('Evento domani', `${e.titolo}${e.ora ? ' alle ' + e.ora : ''}${e.costo ? ' — €' + e.costo.toFixed(2) : ''}`);
        markNotified(key + '_tomorrow');
      }
    }
  }
}

async function checkDeadlines(today) {
  const scadenze = await db.getAll('scadenze');
  for (const s of scadenze) {
    if (s.completata) continue;
    const d = new Date(s.data);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / 86400000);
    const key = `scadenza_${s.id}_${s.data}`;

    if (diff <= 0 && !wasNotified(key + '_expired')) {
      notify('Scadenza passata!', `${s.titolo} — scaduta${s.costo ? ', €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_expired');
    } else if (diff === 1 && !wasNotified(key + '_tomorrow')) {
      notify('Scadenza domani', `${s.titolo}${s.costo ? ' — €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_tomorrow');
    } else if (diff <= 7 && diff > 1 && !wasNotified(key + '_week')) {
      notify(`Scadenza tra ${diff} giorni`, `${s.titolo}${s.costo ? ' — €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_week');
    }
  }
}

async function checkDispensa() {
  const items = await db.getAll('dispensa');
  const terminati = items.filter(i => i.quantita !== null && i.quantita <= 0);
  const scorteBasse = items.filter(i => i.quantita !== null && i.quantita > 0 && i.quantita <= 1);

  if (terminati.length > 0) {
    const key = `dispensa_terminati_${new Date().toISOString().slice(0, 10)}`;
    if (!wasNotified(key)) {
      const nomi = terminati.slice(0, 3).map(i => i.nome).join(', ');
      const extra = terminati.length > 3 ? ` e altri ${terminati.length - 3}` : '';
      notify(
        terminati.length === 1 ? 'Prodotto finito' : `${terminati.length} prodotti finiti`,
        `${nomi}${extra} — aggiungili alla spesa!`
      );
      markNotified(key);
    }
  }

  if (scorteBasse.length > 0) {
    const key = `dispensa_basse_${new Date().toISOString().slice(0, 10)}`;
    if (!wasNotified(key)) {
      const nomi = scorteBasse.map(i => i.nome).join(', ');
      toast(`Scorte basse: ${nomi}`);
      markNotified(key);
    }
  }
}

async function checkSpending(today) {
  const transazioni = await db.getAll('transazioni');

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  if (weekStart > today) weekStart.setDate(weekStart.getDate() - 7);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let weekTotal = 0;
  let monthTotal = 0;

  for (const t of transazioni) {
    if (t.tipo !== 'uscita') continue;
    const d = new Date(t.data);
    d.setHours(0, 0, 0, 0);
    if (d >= monthStart && d <= today) {
      monthTotal += Math.abs(t.importo);
    }
    if (d >= weekStart && d <= today) {
      weekTotal += Math.abs(t.importo);
    }
  }

  const sogliaSettimanale = await db.getSetting('soglia_settimanale');
  const sogliaMensile = await db.getSetting('soglia_mensile');

  if (sogliaSettimanale && weekTotal > sogliaSettimanale) {
    const weekKey = `spending_week_${weekStart.toISOString().slice(0, 10)}`;
    if (!wasNotified(weekKey)) {
      notify('Soglia settimanale superata!', `€${weekTotal.toFixed(2)} / €${sogliaSettimanale} questa settimana`);
      markNotified(weekKey);
    }
  }

  if (sogliaMensile && monthTotal > sogliaMensile) {
    const monthKey = `spending_month_${monthStart.toISOString().slice(0, 7)}`;
    if (!wasNotified(monthKey)) {
      notify('Soglia mensile superata!', `€${monthTotal.toFixed(2)} / €${sogliaMensile} questo mese`);
      markNotified(monthKey);
    }
  }
}

function notify(title, body) {
  toast(`${title}: ${body}`, 5000);
  emit('notification', { title, body });

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: './icons/icon-192.svg',
        badge: './icons/icon-192.svg',
        tag: title,
        vibrate: [200, 100, 200]
      });
    });
  } else {
    try { new Notification(title, { body, icon: './icons/icon-192.svg' }); } catch {}
  }
}

export function startPeriodicCheck(intervalMs = 1800000) {
  checkAndNotify();
  setInterval(checkAndNotify, intervalMs);
}
