const WALLPAPER_KEY = 'dummy-home-wallpaper';
const SETTINGS_KEY = 'dummy-home-settings';
const homeScreen = document.querySelector('.home-screen');
const fileInput = document.querySelector('#screenshot-input');
const blurToggle = document.querySelector('#blur-toggle');
const jiggleToggle = document.querySelector('#jiggle-toggle');
const dockToggle = document.querySelector('#dock-toggle');
const resetButton = document.querySelector('#reset-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const instructionsButton = document.querySelector('#instructions-button');
const instructionsDialog = document.querySelector('#instructions-dialog');
const tips = document.querySelector('#tips');
const statusTime = document.querySelector('#status-time');
const appGrid = document.querySelector('#app-grid');
const dockIconsWrapper = document.querySelector('#dock-icons');
const wallpaperPlaceholder = document.querySelector('#wallpaper-placeholder');
const doneButton = document.querySelector('#done-button');

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const LONG_PRESS_MS = 600;
const MOVE_THRESHOLD_PX = 10;

let longPressTimer = null;
let pressOrigin = null;
let hasShownReduceMotionWarning = false;

const fakeIcons = [
  { label: 'Calendar', color: 'linear-gradient(135deg, #ff5f6d, #ffc371)' },
  { label: 'Photos', color: 'linear-gradient(135deg, #fad961, #f76b1c)' },
  { label: 'Maps', color: 'linear-gradient(135deg, #84fab0, #8fd3f4)' },
  { label: 'Weather', color: 'linear-gradient(135deg, #5ee7df, #b490ca)' },
  { label: 'Reminders', color: 'linear-gradient(135deg, #c79081, #dfa579)' },
  { label: 'Camera', color: 'linear-gradient(135deg, #434343, #000000)' },
  { label: 'Notes', color: 'linear-gradient(135deg, #f7f8f8, #acbb78)' },
  { label: 'Mail', color: 'linear-gradient(135deg, #0061ff, #60efff)' },
  { label: 'Music', color: 'linear-gradient(135deg, #8a2387, #e94057, #f27121)' },
  { label: 'Podcasts', color: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { label: 'App Store', color: 'linear-gradient(135deg, #4776e6, #8e54e9)' },
  { label: 'Settings', color: 'linear-gradient(135deg, #2c3e50, #bdc3c7)' },
  { label: 'Health', color: 'linear-gradient(135deg, #ff512f, #dd2476)' },
  { label: 'Wallet', color: 'linear-gradient(135deg, #414d0b, #727a17)' },
  { label: 'Files', color: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { label: 'Translate', color: 'linear-gradient(135deg, #00cdac, #02aab0)' }
];

const dockIcons = [
  { label: 'Phone', color: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { label: 'Messages', color: 'linear-gradient(135deg, #56ab2f, #a8e063)' },
  { label: 'Safari', color: 'linear-gradient(135deg, #36d1dc, #5b86e5)' },
  { label: 'Music', color: 'linear-gradient(135deg, #ff5f6d, #ffc371)' }
];

const formatTime = () => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  statusTime.textContent = formatter.format(new Date());
};

const createIconElement = ({ label, color }) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'app-icon';
  wrapper.setAttribute('title', label);
  wrapper.setAttribute('aria-label', label);
  wrapper.innerHTML = `
    <div class="tile" style="--icon-color: ${color}"></div>
    <span>${label}</span>
  `;
  return wrapper;
};

const createDockTile = ({ label, color }) => {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.style.setProperty('--icon-color', color);
  tile.setAttribute('title', label);
  tile.setAttribute('aria-label', label);
  return tile;
};

const applyWallpaper = (dataUrl) => {
  if (!dataUrl) {
    document.documentElement.style.removeProperty('--bg-image');
    homeScreen.removeAttribute('data-has-wallpaper');
    wallpaperPlaceholder?.setAttribute('aria-hidden', 'false');
    return;
  }
  document.documentElement.style.setProperty('--bg-image', `url('${dataUrl}')`);
  homeScreen.setAttribute('data-has-wallpaper', 'true');
  wallpaperPlaceholder?.setAttribute('aria-hidden', 'true');
};

const persistState = (wallpaper, settings) => {
  try {
    if (wallpaper !== undefined) {
      localStorage.setItem(WALLPAPER_KEY, wallpaper);
    }
    if (settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.warn('Unable to persist dummy home screen state', error);
  }
};

const loadState = () => {
  let wallpaper = '';
  let settings = {
    blur: false,
    jiggle: false,
    showDock: true
  };
  try {
    wallpaper = localStorage.getItem(WALLPAPER_KEY) || '';
    settings = {
      ...settings,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    };
  } catch (error) {
    console.warn('Unable to load dummy home screen state', error);
  }
  return { wallpaper, settings };
};

const persistSettingsOnly = () => {
  persistState(undefined, getSettings());
};

const setBlur = (value, { persist = true } = {}) => {
  blurToggle.checked = value;
  homeScreen.dataset.showBlur = String(value);
  if (persist) {
    persistSettingsOnly();
  }
};

const setDock = (value, { persist = true } = {}) => {
  dockToggle.checked = value;
  homeScreen.dataset.showDock = String(value);
  if (persist) {
    persistSettingsOnly();
  }
};

const setDoneButtonVisibility = (visible) => {
  if (!doneButton) return;
  doneButton.tabIndex = visible ? 0 : -1;
  doneButton.setAttribute('aria-hidden', String(!visible));
};

const setJiggle = (value, { persist = true, silent = false } = {}) => {
  const shouldEnable = Boolean(value) && !reduceMotionQuery.matches;

  if (value && !shouldEnable && !silent && !hasShownReduceMotionWarning) {
    hasShownReduceMotionWarning = true;
    tips.insertAdjacentHTML(
      'beforeend',
      '<br /><em>Jiggle animation is disabled because of your reduced motion accessibility preference.</em>'
    );
  }

  jiggleToggle.checked = shouldEnable;
  homeScreen.dataset.jiggle = String(shouldEnable);
  setDoneButtonVisibility(shouldEnable);

  if (persist) {
    persistSettingsOnly();
  }

  return shouldEnable;
};

const applySettings = (settings) => {
  setBlur(Boolean(settings.blur), { persist: false });
  const appliedJiggle = setJiggle(Boolean(settings.jiggle), { persist: false, silent: true });
  setDock(Boolean(settings.showDock), { persist: false });

  if (Boolean(settings.jiggle) !== appliedJiggle) {
    persistSettingsOnly();
  }
};

const handleFile = async (file) => {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  applyWallpaper(dataUrl);
  persistState(dataUrl, getSettings());
};

const getSettings = () => ({
  blur: blurToggle.checked,
  jiggle: jiggleToggle.checked,
  showDock: dockToggle.checked
});

const updateTips = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) {
    tips.innerHTML = `
      1. Upload the screenshot of your current Home Screen above.<br />
      2. Long-press any icon to enter jiggle mode, then tap <strong>Done</strong> to stop.<br />
      3. Tap the share icon in Safari and choose <strong>Add to Home Screen</strong>.
    `;
  } else {
    tips.innerHTML = `
      Use this on your iPhone or iPad by scanning the QR code of this page or by sending yourself the link. Then open it in Safari, long-press any icon to enter jiggle mode, and use <strong>Add to Home Screen</strong> to install the PWA.`;
  }
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

const updateFullscreenButtonLabel = () => {
  if (!fullscreenButton) return;
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Go fullscreen';
};

const clearLongPressTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const cancelLongPress = () => {
  clearLongPressTimer();
  pressOrigin = null;
};

const startLongPress = (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (reduceMotionQuery.matches) return;

  pressOrigin = { x: event.clientX, y: event.clientY };
  clearLongPressTimer();
  longPressTimer = window.setTimeout(() => {
    setJiggle(true);
    cancelLongPress();
  }, LONG_PRESS_MS);
};

const handlePressMove = (event) => {
  if (!pressOrigin || longPressTimer === null) return;
  const dx = event.clientX - pressOrigin.x;
  const dy = event.clientY - pressOrigin.y;
  if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
    cancelLongPress();
  }
};

const handleReduceMotionChange = () => {
  if (reduceMotionQuery.matches && jiggleToggle.checked) {
    setJiggle(false);
  }
};

const initIcons = () => {
  fakeIcons.forEach((icon) => appGrid.appendChild(createIconElement(icon)));
  dockIcons.forEach((icon) => dockIconsWrapper.appendChild(createDockTile(icon)));
};

const init = () => {
  initIcons();
  updateTips();
  formatTime();
  setInterval(formatTime, 30_000);

  const { wallpaper, settings } = loadState();
  if (wallpaper) {
    applyWallpaper(wallpaper);
  }
  applySettings(settings);

  fileInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    handleFile(file);
  });

  blurToggle.addEventListener('change', () => setBlur(blurToggle.checked));

  jiggleToggle.addEventListener('change', () => setJiggle(jiggleToggle.checked));

  dockToggle.addEventListener('change', () => setDock(dockToggle.checked));

  resetButton.addEventListener('click', () => {
    applyWallpaper('');
    persistState('', getSettings());
    fileInput.value = '';
  });

  fullscreenButton.addEventListener('click', () => {
    toggleFullscreen();
  });

  document.addEventListener('fullscreenchange', updateFullscreenButtonLabel);
  updateFullscreenButtonLabel();

  if (instructionsButton) {
    instructionsButton.addEventListener('click', () => {
      if (instructionsDialog && typeof instructionsDialog.showModal === 'function') {
        instructionsDialog.showModal();
      } else {
        alert('In Safari, tap the share icon and choose "Add to Home Screen" to install the dummy.');
      }
    });
  }

  instructionsDialog?.addEventListener('close', () => {
    instructionsButton?.focus();
  });

  doneButton?.addEventListener('click', () => setJiggle(false));

  [appGrid, dockIconsWrapper].forEach((element) => {
    element.addEventListener('pointerdown', startLongPress);
    element.addEventListener('pointermove', handlePressMove);
    element.addEventListener('pointerup', cancelLongPress);
    element.addEventListener('pointercancel', cancelLongPress);
    element.addEventListener('pointerleave', cancelLongPress);
  });

  document.addEventListener('pointerup', cancelLongPress);
  document.addEventListener('pointercancel', cancelLongPress);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setJiggle(false);
    }
  });

  reduceMotionQuery.addEventListener?.('change', handleReduceMotionChange);
  reduceMotionQuery.addListener?.(handleReduceMotionChange);
  handleReduceMotionChange();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .catch((error) => console.error('Service worker registration failed', error));
    });
  }
};

init();
