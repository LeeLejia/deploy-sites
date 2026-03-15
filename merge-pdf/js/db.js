const DB = {
  db: null,
  DB_NAME: 'LawyerToolDB',
  DB_VERSION: 2,
  STORE: 'files',

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains(this.STORE)) {
          db.deleteObjectStore(this.STORE);
        }
        const store = db.createObjectStore(this.STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('path', 'path', { unique: false });
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  _tx(mode) {
    return this.db.transaction(this.STORE, mode).objectStore(this.STORE);
  },

  async save(fileData) {
    return new Promise((resolve, reject) => {
      const store = this._tx('readwrite');
      const req = store.put(fileData);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async get(id) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll() {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async update(id, updates) {
    const file = await this.get(id);
    if (!file) return;
    Object.assign(file, updates);
    await this.save(file);
  },

  async remove(id) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async clear() {
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }
};
