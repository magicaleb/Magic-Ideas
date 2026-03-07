const APP_KEY = 'iphoneMirage';

const APP_CATALOG = [
  { id: 'calendar', label: 'Calendar', glyph: '17', color: 'linear-gradient(#fff,#f0f0f0)', page: 0 },
  { id: 'photos', label: 'Photos', glyph: '✿', color: 'linear-gradient(140deg,#ffd25c,#ff6b6b,#a16bff)', page: 0 },
  { id: 'camera', label: 'Camera', glyph: '◉', color: 'linear-gradient(#5d5d5d,#2c2c2c)', page: 0 },
  { id: 'mail', label: 'Mail', glyph: '✉', color: 'linear-gradient(#4ab4ff,#0a6fff)', page: 0 },
  { id: 'maps', label: 'Maps', glyph: '🗺', color: 'linear-gradient(#5be7ff,#53da77)', page: 0 },
  { id: 'weather', label: 'Weather', glyph: '☀', color: 'linear-gradient(#5fbeff,#2f77ff)', page: 0 },
  { id: 'clock', label: 'Clock', glyph: '🕒', color: 'linear-gradient(#2e2e2e,#111)', page: 0 },
  { id: 'notes', label: 'Notes', glyph: '▤', color: 'linear-gradient(#fff38a,#f7d43f)', page: 0 },
  { id: 'reminders', label: 'Reminders', glyph: '•', color: 'linear-gradient(#fff,#f0f0f0)', page: 1 },
  { id: 'stocks', label: 'Stocks', glyph: '📈', color: 'linear-gradient(#1c1c1c,#000)', page: 1 },
  { id: 'music', label: 'Music', glyph: '♪', color: 'linear-gradient(#ff5e8b,#ff255a)', page: 1 },
  { id: 'podcasts', label: 'Podcasts', glyph: '◍', color: 'linear-gradient(#c774ff,#9a44ff)', page: 1 },
  { id: 'youtube', label: 'YouTube', glyph: '▶', color: 'linear-gradient(#ff4a4a,#d60000)', page: 1 },
  { id: 'instagram', label: 'Instagram', glyph: '◌', color: 'linear-gradient(135deg,#ffd86a,#ff4da0,#8a56ff)', page: 1 },
  { id: 'tiktok', label: 'TikTok', glyph: '♪', color: 'linear-gradient(#252525,#000)', page: 1 },
  { id: 'spotify', label: 'Spotify', glyph: '☊', color: 'linear-gradient(#1adb66,#169b47)', page: 1 },
  { id: 'x', label: 'X', glyph: '𝕏', color: 'linear-gradient(#2a2a2a,#000)', page: 2 },
  { id: 'facebook', label: 'Facebook', glyph: 'f', color: 'linear-gradient(#1877f2,#0f4fbf)', page: 2 },
  { id: 'whatsapp', label: 'WhatsApp', glyph: '✆', color: 'linear-gradient(#42dd78,#0fb050)', page: 2 },
  { id: 'netflix', label: 'Netflix', glyph: 'N', color: 'linear-gradient(#1c1c1c,#000)', page: 2 },
  { id: 'uber', label: 'Uber', glyph: '⬢', color: 'linear-gradient(#343434,#090909)', page: 2 },
  { id: 'airbnb', label: 'Airbnb', glyph: '⌂', color: 'linear-gradient(#ff778b,#ff355b)', page: 2 },
  { id: 'chatgpt', label: 'ChatGPT', glyph: '✺', color: 'linear-gradient(#6df0c5,#1ea476)', page: 2 },
  { id: 'calculator', label: 'Calculator', glyph: '±', color: 'linear-gradient(#444,#1b1b1b)', page: 2 },
  { id: 'phone', label: 'Phone', glyph: '✆', color: 'linear-gradient(#58de6f,#0dad3f)', dock: true },
  { id: 'safari', label: 'Safari', glyph: '🧭', color: 'linear-gradient(#66d9ff,#107dff)', dock: true },
  { id: 'messages', label: 'Messages', glyph: '💬', color: 'linear-gradient(#60e87d,#2eb956)', dock: true },
  { id: 'special', label: 'Utilities', glyph: '⚙', color: 'linear-gradient(#a8a8a8,#717171)', dock: true }
];

const DEFAULTS = {
  wallpaper: '',
  triggerAppId: 'special',
  appValues: {},
  currentResult: '',
  clipboardProbe: ''
};

function loadState() {
  const raw = Storage.load(APP_KEY, DEFAULTS) || {};
  return {
    ...DEFAULTS,
    ...raw,
    appValues: { ...(DEFAULTS.appValues || {}), ...(raw.appValues || {}) }
  };
}

function saveState(state) {
  Storage.save(APP_KEY, state);
}

function appById(id) {
  return APP_CATALOG.find((app) => app.id === id);
}

function iconButton(app) {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.dataset.appId = app.id;
  btn.innerHTML = `
    <span class="icon-tile" style="background:${app.color}">${app.glyph}</span>
    <span class="icon-label">${app.label}</span>
  `;
  return btn;
}

function applyWallpaper(el, wallpaper) {
  if (wallpaper) {
    el.style.backgroundImage = `url(${wallpaper})`;
    return;
  }
  el.style.backgroundImage = 'linear-gradient(150deg,#3355bb 0%,#7d57d8 35%,#df6f9f 100%)';
}

function initSettingsPage() {
  const state = loadState();
  const wallpaperInput = document.getElementById('wallpaperInput');
  const triggerSelect = document.getElementById('triggerApp');
  const appMap = document.getElementById('appMap');
  const currentResult = document.getElementById('currentResult');
  const clipboardProbe = document.getElementById('clipboardProbe');
  const goPerform = document.getElementById('goPerform');
  const resetBuffer = document.getElementById('resetBuffer');

  APP_CATALOG.forEach((app) => {
    const option = document.createElement('option');
    option.value = app.id;
    option.textContent = app.label;
    triggerSelect.appendChild(option);

    const wrapper = document.createElement('div');
    wrapper.className = 'map-item';
    const value = state.appValues[app.id] || '';
    wrapper.innerHTML = `
      <div class="map-title"><span>${app.glyph}</span><span>${app.label}</span></div>
      <input type="text" data-map-input="${app.id}" placeholder="Value when tapped" value="${value}">
    `;
    appMap.appendChild(wrapper);
  });

  const hasTrigger = APP_CATALOG.some((app) => app.id === state.triggerAppId);
  state.triggerAppId = hasTrigger ? state.triggerAppId : DEFAULTS.triggerAppId;
  triggerSelect.value = state.triggerAppId;
  currentResult.textContent = state.currentResult || '(empty)';
  clipboardProbe.value = state.clipboardProbe || '';
  saveState(state);

  appMap.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.mapInput) {
      return;
    }
    state.appValues[target.dataset.mapInput] = target.value;
    saveState(state);
  });

  triggerSelect.addEventListener('change', () => {
    state.triggerAppId = triggerSelect.value;
    saveState(state);
  });

  wallpaperInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.wallpaper = reader.result;
      saveState(state);
    };
    reader.readAsDataURL(file);
  });

  clipboardProbe.addEventListener('input', () => {
    state.clipboardProbe = clipboardProbe.value;
    saveState(state);
  });

  resetBuffer.addEventListener('click', () => {
    state.currentResult = '';
    currentResult.textContent = '(empty)';
    saveState(state);
  });

  goPerform.addEventListener('click', () => {
    window.location.href = './perform.html';
  });
}

function initPerformPage() {
  const state = loadState();
  if (!APP_CATALOG.some((app) => app.id === state.triggerAppId)) {
    state.triggerAppId = DEFAULTS.triggerAppId;
    saveState(state);
  }
  let activePage = 0;
  let collecting = true;
  let buffer = state.currentResult || '';

  const screen = document.getElementById('screen');
  const pagesTrack = document.getElementById('pagesTrack');
  const dock = document.getElementById('dock');
  const pageDots = document.getElementById('pageDots');
  const toast = document.getElementById('toast');
  const timeEl = document.getElementById('time');

  const maxPage = Math.max(...APP_CATALOG.filter((app) => !app.dock).map((app) => app.page));
  applyWallpaper(screen, state.wallpaper);

  const updateTime = () => {
    timeEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  updateTime();
  setInterval(updateTime, 1000 * 30);

  for (let i = 0; i <= maxPage; i += 1) {
    const page = document.createElement('div');
    page.className = 'page';
    APP_CATALOG.filter((app) => app.page === i).forEach((app) => page.appendChild(iconButton(app)));
    pagesTrack.appendChild(page);

    const dot = document.createElement('span');
    dot.className = `page-dot ${i === 0 ? 'active' : ''}`;
    dot.dataset.dot = String(i);
    pageDots.appendChild(dot);
  }

  APP_CATALOG.filter((app) => app.dock).forEach((app) => dock.appendChild(iconButton(app)));

  const paintPage = () => {
    pagesTrack.style.transform = `translateX(${-activePage * 100}%)`;
    pageDots.querySelectorAll('.page-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.dot) === activePage);
    });
  };

  const emitToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(emitToast.timer);
    emitToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1200);
  };

  const persistResult = () => {
    state.currentResult = buffer;
    saveState(state);
  };

  const appendFromApp = (appId) => {
    if (!collecting) {
      emitToast('Sequence locked. Use your reset action in Settings.');
      return;
    }

    if (appId === state.triggerAppId) {
      collecting = false;
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        emitToast('Clipboard unavailable in this browser');
      } else {
        navigator.clipboard.writeText(buffer).then(() => {
          emitToast(`Copied: ${buffer || '(empty)'}`);
        }).catch(() => emitToast('Clipboard blocked by browser'));
      }
      persistResult();
      return;
    }

    const chunk = state.appValues[appId];
    if (!chunk) {
      emitToast(`${appById(appId)?.label || 'App'} has no value assigned`);
      return;
    }

    buffer += chunk;
    persistResult();
    emitToast(`Added ${chunk}`);
  };

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('.icon-btn');
    if (!button) {
      return;
    }
    appendFromApp(button.dataset.appId);
  });

  let startX = 0;
  let startY = 0;

  document.getElementById('pagesViewport').addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });

  document.getElementById('pagesViewport').addEventListener('touchend', (event) => {
    const dx = event.changedTouches[0].clientX - startX;
    const dy = Math.abs(event.changedTouches[0].clientY - startY);
    if (Math.abs(dx) < 28 || dy > 50) {
      return;
    }
    activePage += dx > 0 ? -1 : 1;
    activePage = Math.max(0, Math.min(maxPage, activePage));
    paintPage();
  }, { passive: true });

  // Secret access flow: long-press Clock icon then tap top-left corner 3 times quickly.
  let armedUntil = 0;
  let cornerTapCount = 0;

  document.body.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('.icon-btn');
    if (!button || button.dataset.appId !== 'clock') {
      return;
    }
    const begin = Date.now();
    const clear = () => {
      document.body.removeEventListener('pointerup', clear);
      document.body.removeEventListener('pointercancel', clear);
      if (Date.now() - begin >= 1100) {
        armedUntil = Date.now() + 2500;
        cornerTapCount = 0;
        emitToast('Access armed');
      }
    };
    document.body.addEventListener('pointerup', clear);
    document.body.addEventListener('pointercancel', clear);
  });

  document.getElementById('settingsHotspot').addEventListener('click', () => {
    if (Date.now() > armedUntil) {
      return;
    }
    cornerTapCount += 1;
    if (cornerTapCount >= 3) {
      window.location.href = './settings.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'settings') {
    initSettingsPage();
    return;
  }
  if (page === 'perform') {
    initPerformPage();
  }
});
