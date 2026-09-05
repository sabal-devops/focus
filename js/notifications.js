import * as db from './db.js';

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
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const eventi = await db.getAll('eventi');
  for (const e of eventi) {
    const dates = expandRecurringDates(e, today, dayAfter);
    for (const d of dates) {
      d.setHours(0, 0, 0, 0);
      const dateKey = d.toISOString().slice(0, 10);
      const key = `evento_${e.id}_${dateKey}`;

      if (d.getTime() === today.getTime() && !wasNotified(key)) {
        showNotification('Evento oggi', `${e.titolo}${e.ora ? ' alle ' + e.ora : ''}${e.costo ? ' — €' + e.costo.toFixed(2) : ''}`);
        markNotified(key);
      } else if (d.getTime() === tomorrow.getTime() && !wasNotified(key + '_tomorrow')) {
        showNotification('Evento domani', `${e.titolo}${e.ora ? ' alle ' + e.ora : ''}${e.costo ? ' — €' + e.costo.toFixed(2) : ''}`);
        markNotified(key + '_tomorrow');
      }
    }
  }

  const scadenze = await db.getAll('scadenze');
  for (const s of scadenze) {
    if (s.completata) continue;
    const d = new Date(s.data);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / 86400000);
    const key = `scadenza_${s.id}_${s.data}`;

    if (diff <= 0 && !wasNotified(key + '_expired')) {
      showNotification('Scadenza passata!', `${s.titolo} — scaduta${s.costo ? ', €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_expired');
    } else if (diff === 1 && !wasNotified(key + '_tomorrow')) {
      showNotification('Scadenza domani', `${s.titolo}${s.costo ? ' — €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_tomorrow');
    } else if (diff <= 7 && diff > 1 && !wasNotified(key + '_week')) {
      showNotification(`Scadenza tra ${diff} giorni`, `${s.titolo}${s.costo ? ' — €' + s.costo.toFixed(2) : ''}`);
      markNotified(key + '_week');
    }
  }
}

function showNotification(title, body) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: './icons/icon-192.svg',
        badge: './icons/icon-192.svg',
        tag: title + body,
        vibrate: [200, 100, 200]
      });
    });
  } else {
    new Notification(title, { body, icon: './icons/icon-192.svg' });
  }
}

export function startPeriodicCheck(intervalMs = 3600000) {
  checkAndNotify();
  setInterval(checkAndNotify, intervalMs);
}
