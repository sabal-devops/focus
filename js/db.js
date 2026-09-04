const DB_NAME = 'nodo';
const DB_VERSION = 1;

const STORES = {
  messages: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'timestamp', keyPath: 'timestamp' }] },
  spesa: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'completato', keyPath: 'completato' }] },
  dispensa: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'nome', keyPath: 'nome' }] },
  transazioni: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'data', keyPath: 'data' }, { name: 'categoria', keyPath: 'categoria' }] },
  impostazioni: { keyPath: 'key' },
};

let dbInstance = null;

function open() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: config.keyPath, autoIncrement: config.autoIncrement });
          if (config.indexes) {
            for (const idx of config.indexes) {
              store.createIndex(idx.name, idx.keyPath, { unique: false });
            }
          }
        }
      }
    };
    req.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return open().then(db => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function add(storeName, data) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.add({ ...data }));
}

export async function put(storeName, data) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.put({ ...data }));
}

export async function get(storeName, id) {
  const store = await tx(storeName);
  return reqToPromise(store.get(id));
}

export async function getAll(storeName) {
  const store = await tx(storeName);
  return reqToPromise(store.getAll());
}

export async function del(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.delete(id));
}

export async function clear(storeName) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.clear());
}

export async function getByIndex(storeName, indexName, value) {
  const store = await tx(storeName);
  const index = store.index(indexName);
  return reqToPromise(index.getAll(value));
}

export async function getSetting(key) {
  const result = await get('impostazioni', key);
  return result ? result.value : null;
}

export async function setSetting(key, value) {
  return put('impostazioni', { key, value });
}

export { open };
