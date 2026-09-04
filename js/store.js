const listeners = new Map();

export function on(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event).delete(callback);
}

export function emit(event, data) {
  if (listeners.has(event)) {
    for (const cb of listeners.get(event)) {
      cb(data);
    }
  }
}
