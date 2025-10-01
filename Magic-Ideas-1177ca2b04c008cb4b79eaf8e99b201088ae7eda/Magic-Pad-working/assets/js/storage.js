/* STORAGE HELPER */
const Storage = {
  load: (key, defaults) => {
    try {
      const raw = localStorage.getItem('mpad.' + key);
      return raw ? JSON.parse(raw) : defaults;
    } catch (_) { return defaults; }
  },
  save: (key, obj) => {
    try { localStorage.setItem('mpad.' + key, JSON.stringify(obj)); }
    catch (_) {}
  }
};
