/* Settings in localStorage; large wallpaper images in IndexedDB. */
const Storage = (() => {
  'use strict';

  const PREFIX = 'mpad.';
  const MEDIA_PREFIX = `${PREFIX}media.`;
  const DB_NAME = 'magic-ideas-media';
  const DB_VERSION = 1;
  const IMAGE_STORE = 'images';
  let databasePromise = null;

  function load(key, defaults) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (
        defaults && parsed &&
        typeof defaults === 'object' && typeof parsed === 'object' &&
        !Array.isArray(defaults) && !Array.isArray(parsed)
      ) {
        return { ...defaults, ...parsed };
      }
      return parsed;
    } catch (_) {
      return defaults;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is unavailable'));
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IMAGE_STORE)) {
          database.createObjectStore(IMAGE_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open image storage'));
      request.onblocked = () => reject(new Error('Image storage is blocked by another tab'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });

    return databasePromise;
  }

  async function writeImageToDatabase(key, blob) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, 'readwrite');
      transaction.objectStore(IMAGE_STORE).put({ key, blob, updatedAt: Date.now() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save image'));
      transaction.onabort = () => reject(transaction.error || new Error('Image save was cancelled'));
    });
  }

  async function readImageFromDatabase(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, 'readonly');
      const request = transaction.objectStore(IMAGE_STORE).get(key);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error || new Error('Unable to load image'));
    });
  }

  async function deleteImageFromDatabase(key) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, 'readwrite');
      transaction.objectStore(IMAGE_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to delete image'));
      transaction.onabort = () => reject(transaction.error || new Error('Image delete was cancelled'));
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Unable to read image'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
    if (!match) throw new Error('Invalid image data');
    const mimeType = match[1] || 'application/octet-stream';
    const bytes = match[2]
      ? atob(match[3])
      : decodeURIComponent(match[3]);
    const output = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) output[index] = bytes.charCodeAt(index);
    return new Blob([output], { type: mimeType });
  }

  async function saveImage(key, image) {
    let blob = image;
    if (typeof image === 'string') blob = dataUrlToBlob(image);
    if (typeof Blob === 'undefined' || !(blob instanceof Blob)) {
      throw new TypeError('saveImage expects an image Blob, File, or data URL');
    }

    try {
      await writeImageToDatabase(key, blob);
      try { localStorage.removeItem(MEDIA_PREFIX + key); } catch (_) {}
      return { ok: true, storage: 'indexeddb', size: blob.size, type: blob.type };
    } catch (databaseError) {
      try {
        const dataUrl = await blobToDataUrl(blob);
        localStorage.setItem(MEDIA_PREFIX + key, dataUrl);
        return { ok: true, storage: 'localstorage', size: blob.size, type: blob.type };
      } catch (fallbackError) {
        const error = new Error('The wallpaper could not be saved. Try a smaller image or leave private browsing.');
        error.cause = fallbackError || databaseError;
        throw error;
      }
    }
  }

  async function loadImage(key) {
    try {
      const blob = await readImageFromDatabase(key);
      if (blob) return blob;
    } catch (_) {}

    try {
      return localStorage.getItem(MEDIA_PREFIX + key) || null;
    } catch (_) {
      return null;
    }
  }

  async function deleteImage(key) {
    try { await deleteImageFromDatabase(key); } catch (_) {}
    try { localStorage.removeItem(MEDIA_PREFIX + key); } catch (_) {}
    return true;
  }

  function createImageUrl(image) {
    if (!image) return { url: '', revoke() {} };
    if (typeof image === 'string') return { url: image, revoke() {} };
    const url = URL.createObjectURL(image);
    return { url, revoke() { URL.revokeObjectURL(url); } };
  }

  return Object.freeze({
    load,
    save,
    remove,
    saveImage,
    loadImage,
    deleteImage,
    createImageUrl,
    dataUrlToBlob
  });
})();

if (typeof module === 'object' && module.exports) {
  module.exports = Storage;
}
