/* =========================================================
   STORAGE HELPER
   - Tiny wrapper around localStorage with JSON parsing.
   - Namespaces keys with "mpad." to avoid collisions.
   ========================================================= */

const Storage = {
  // Load JSON under "mpad.<key>". If not present or invalid, return defaults.
  load: (key, defaults) => {
    try {
      const raw = localStorage.getItem('mpad.' + key);
      return raw ? JSON.parse(raw) : defaults;
    } catch (e) {
      return defaults;
    }
  },

  // Save JSON under "mpad.<key>".
  save: (key, obj) => {
    try {
      localStorage.setItem('mpad.' + key, JSON.stringify(obj));
    } catch (e) {
      // Storage can fail if quota exceeded or in private mode.
      // Intentionally silent to avoid on-screen tells.
    }
  }
};
