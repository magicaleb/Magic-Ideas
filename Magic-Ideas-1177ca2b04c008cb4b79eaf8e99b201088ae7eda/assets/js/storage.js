/* JSON localStorage with mpad.* namespace */
const Storage = {
  load: (key, defaults) => {
    try { const raw = localStorage.getItem('mpad.'+key); return raw ? JSON.parse(raw) : defaults; }
    catch { return defaults; }
  },
  save: (key, obj) => {
    try { localStorage.setItem('mpad.'+key, JSON.stringify(obj)); } catch {}
  }
};