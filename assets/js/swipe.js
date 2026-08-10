/* Shared Swipe Input engine used by both performance surfaces. */
const Swipe = (() => {
  'use strict';

  const CONFIG_VERSION = 4;
  const CLIPBOARD_DEFAULT_VERSION = 2;
  const INPUT_MODES = Object.freeze(['twoswipe', 'clockface', 'cards', 'customface', 'tapzones']);
  const DEFAULTS = Object.freeze({
    version: CONFIG_VERSION,
    delay: 3,
    shortcut: '',
    shortcutEnabled: false,
    shortcutNames: Object.freeze([]),
    postShortcut: '',
    clipboard: true,
    fakeHomescreen: false,
    practiceMode: false,
    hasHomescreenImage: false,
    homescreenImage: '',
    inputMode: 'twoswipe',
    cardOutputFormat: 'compact',
    customFaces: Object.freeze([]),
    activeCustomFaceId: '',
    tapGrid: Object.freeze({ rows: 6, columns: 4, zones: Object.freeze([]) }),
    useTwoSwipe: true
  });

  function getProfiles() {
    if (typeof InputProfiles !== 'undefined') return InputProfiles;
    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      try { return require('./inputProfiles.js'); } catch (_) {}
    }
    return null;
  }

  function uniqueStrings(value, limit = 30) {
    const values = Array.isArray(value) ? value : [];
    const seen = new Set();
    const result = [];
    values.forEach((item) => {
      const normalized = String(item || '').trim().slice(0, 120);
      const key = normalized.toLocaleLowerCase();
      if (!normalized || seen.has(key) || result.length >= limit) return;
      seen.add(key);
      result.push(normalized);
    });
    return result;
  }

  function fallbackTapGrid() {
    const zones = Array.from({ length: 24 }, () => ({ kind: 'empty', value: '' }));
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((value, index) => {
      zones[index] = { kind: 'append', value };
    });
    zones[10] = { kind: 'backspace', value: '' };
    zones[11] = { kind: 'submit', value: '' };
    zones[23] = { kind: 'clear', value: '' };
    return { rows: 6, columns: 4, zones };
  }

  function normalizeConfig(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const oldVersion = Number(source.version) || 0;
    const legacyMode = source.useTwoSwipe === false ? 'clockface' : 'twoswipe';
    const inputMode = INPUT_MODES.includes(source.inputMode) ? source.inputMode : legacyMode;
    const profiles = getProfiles();
    const customFaces = profiles?.normalizeFaces ? profiles.normalizeFaces(source.customFaces) : [];
    const requestedFaceId = String(source.activeCustomFaceId || '');
    const activeCustomFaceId = customFaces.some((face) => face.id === requestedFaceId)
      ? requestedFaceId
      : (customFaces[0]?.id || '');
    const selectedShortcut = String(source.shortcut || '').trim().slice(0, 120);
    const shortcutNames = uniqueStrings([...(Array.isArray(source.shortcutNames) ? source.shortcutNames : []), selectedShortcut]);
    const shortcut = shortcutNames.find((name) => name.toLocaleLowerCase() === selectedShortcut.toLocaleLowerCase()) || shortcutNames[0] || '';
    const shortcutEnabled = oldVersion >= CONFIG_VERSION || Object.prototype.hasOwnProperty.call(source, 'shortcutEnabled')
      ? Boolean(source.shortcutEnabled)
      : Boolean(shortcut);

    return {
      version: CONFIG_VERSION,
      delay: Math.min(60, Math.max(1, Number(source.delay) || DEFAULTS.delay)),
      shortcut,
      shortcutEnabled: shortcutEnabled && Boolean(shortcut),
      shortcutNames,
      postShortcut: String(source.postShortcut || '').trim().slice(0, 120),
      // Clipboard is promoted to an on-by-default core behavior in v2. A user
      // can still explicitly turn it off after the one-time migration.
      clipboard: oldVersion >= CLIPBOARD_DEFAULT_VERSION ? source.clipboard !== false : true,
      fakeHomescreen: Boolean(source.fakeHomescreen),
      practiceMode: Boolean(source.practiceMode),
      hasHomescreenImage: Boolean(source.hasHomescreenImage || source.homescreenImage),
      homescreenImage: typeof source.homescreenImage === 'string' ? source.homescreenImage : '',
      inputMode,
      cardOutputFormat: source.cardOutputFormat === 'words' ? 'words' : 'compact',
      customFaces,
      activeCustomFaceId,
      tapGrid: profiles?.normalizeTapGrid
        ? profiles.normalizeTapGrid(source.tapGrid || profiles.defaultTapGrid('numbers'))
        : fallbackTapGrid(),
      useTwoSwipe: inputMode === 'twoswipe'
    };
  }

  function mergeConfig(argument = {}) {
    let saved = {};
    try {
      if (typeof Storage !== 'undefined' && Storage.load) saved = Storage.load('swipe', {}) || {};
    } catch (_) {}
    return normalizeConfig({ ...saved, ...argument });
  }

  function legacyCopy(text) {
    if (typeof document === 'undefined' || !document.body) return false;
    let input = null;
    try {
      input = document.createElement('textarea');
      input.value = text;
      input.readOnly = true;
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px;';
      document.body.appendChild(input);
      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, input.value.length);
      return Boolean(document.execCommand && document.execCommand('copy'));
    } catch (_) {
      return false;
    } finally {
      if (input && input.parentNode) input.parentNode.removeChild(input);
    }
  }

  function copyText(text) {
    let modernCopy = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        // Calling writeText while still inside touchend preserves the browser's
        // transient user activation, even though the promise settles later.
        modernCopy = navigator.clipboard.writeText(text);
      }
    } catch (_) {}

    const legacySucceeded = legacyCopy(text);
    if (modernCopy && typeof modernCopy.then === 'function') {
      return modernCopy.then(() => true).catch(() => legacySucceeded);
    }
    return Promise.resolve(legacySucceeded);
  }

  function removeLastGrapheme(value) {
    const text = String(value || '');
    if (!text) return '';
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
        return segments.slice(0, -1).map((entry) => entry.segment).join('');
      }
    } catch (_) {}
    return Array.from(text).slice(0, -1).join('').replace(/[\uFE0E\uFE0F]$/u, '');
  }

  function cardinalDirection(angle, gesture) {
    if (gesture?.direction) return gesture.direction;
    if (gesture && Number.isFinite(gesture.deltaX) && Number.isFinite(gesture.deltaY)) {
      return Math.abs(gesture.deltaX) > Math.abs(gesture.deltaY)
        ? (gesture.deltaX >= 0 ? 'right' : 'left')
        : (gesture.deltaY >= 0 ? 'down' : 'up');
    }
    const normalized = ((Number(angle) || 0) % 360 + 360) % 360;
    if (normalized < 45 || normalized >= 315) return 'right';
    if (normalized < 135) return 'down';
    if (normalized < 225) return 'left';
    return 'up';
  }

  function start(configArgument = {}, hooks = {}) {
    if (typeof ClockInput === 'undefined') throw new Error('clockInput.js must be loaded before swipe.js');
    if (typeof Gestures === 'undefined') throw new Error('gestureDetector.js and gestures.js must be loaded before swipe.js');

    const config = mergeConfig(configArgument);
    const profiles = getProfiles();
    if (['cards', 'customface', 'tapzones'].includes(config.inputMode) && !profiles) {
      throw new Error('inputProfiles.js must be loaded before swipe.js for this input method');
    }

    const surface = hooks.element || document.getElementById('performRoot') || document.body;
    const gestureInput = Gestures.create(surface, {
      minSwipeDistance: 32,
      maxTapDistance: 14,
      twoFingerHoldDuration: 750,
      twoFingerSwipeDistance: 52,
      preventDefault: true
    });

    let buffer = '';
    let submitTimer = null;
    let destroyed = false;
    let clipboardRequest = 0;
    let clipboardValue = '';
    let clipboardWarningShown = false;
    let tapCard = { suit: '', rank: '' };

    const call = (handler, ...args) => {
      try { if (typeof handler === 'function') handler(...args); } catch (_) {}
    };

    function sequenceTimedOut(label) {
      call(hooks.onSequence, { complete: false, stage: 'first', reason: 'timeout' }, buffer);
      paint();
      if (buffer) submit('sequenceTimeout');
      else call(hooks.onStatus, `${label} input reset`);
    }

    const twoSwipeInput = new ClockInput.TwoSwipeInput({
      timeoutMs: 3000,
      onTimeout() { sequenceTimedOut('Two-swipe'); }
    });

    const activeFace = config.customFaces.find((face) => face.id === config.activeCustomFaceId);
    const profileInput = config.inputMode === 'cards'
      ? new profiles.CardInput({ timeoutMs: 3000, format: config.cardOutputFormat, onTimeout: () => sequenceTimedOut('Card') })
      : (config.inputMode === 'customface' && activeFace
        ? new profiles.CustomFaceInput(activeFace, { timeoutMs: 3000, onTimeout: () => sequenceTimedOut('Custom face') })
        : null);

    function paint() {
      call(hooks.onDigit, null, buffer);
      call(hooks.onValue, null, buffer);
    }

    function clearSubmitTimer() {
      if (submitTimer !== null) {
        clearTimeout(submitTimer);
        submitTimer = null;
      }
    }

    function armSubmitTimer() {
      clearSubmitTimer();
      submitTimer = setTimeout(() => submit('timer'), config.delay * 1000);
    }

    function keepClipboardCurrent(value) {
      if (!config.clipboard || !value) return Promise.resolve(false);
      const request = ++clipboardRequest;
      return copyText(value).then((succeeded) => {
        if (destroyed || request !== clipboardRequest) return succeeded;
        if (succeeded) {
          clipboardValue = value;
          clipboardWarningShown = false;
        } else if (!clipboardWarningShown) {
          clipboardWarningShown = true;
          call(hooks.onStatus, 'Clipboard blocked — allow clipboard access and use HTTPS');
        }
        call(hooks.onClipboard, value, succeeded);
        return succeeded;
      });
    }

    function commitValue(value, options = {}) {
      const text = String(value ?? '');
      if (!text) return false;
      buffer = options.replace ? text : buffer + text;
      call(hooks.onDigit, text, buffer);
      call(hooks.onValue, text, buffer);
      keepClipboardCurrent(buffer);
      armSubmitTimer();
      return true;
    }

    function resetSequences() {
      twoSwipeInput.reset();
      profileInput?.reset();
      tapCard = { suit: '', rank: '' };
    }

    function processSwipe(angle, gesture) {
      if (destroyed || config.inputMode === 'tapzones') return;

      if (config.inputMode === 'twoswipe') {
        const result = twoSwipeInput.process(gesture || angle);
        call(hooks.onSequence, result, buffer);
        if (!result.complete) {
          clearSubmitTimer();
          if (result.restarted) call(hooks.onStatus, 'New first swipe registered');
          return;
        }
        commitValue(result.digit);
        return;
      }

      if (config.inputMode === 'clockface') {
        const position = gesture
          ? ClockInput.vectorToClockPosition(gesture.deltaX, gesture.deltaY)
          : ClockInput.screenAngleToClockPosition(angle);
        const digit = ClockInput.clockPositionToDigit(position);
        if (digit !== null) commitValue(digit);
        return;
      }

      if (!profileInput) {
        call(hooks.onStatus, 'Choose or create a custom clock face in Settings');
        return;
      }

      const result = profileInput.process(cardinalDirection(angle, gesture));
      call(hooks.onSequence, result, buffer);
      if (!result.complete) {
        clearSubmitTimer();
        return;
      }
      commitValue(result.value, { replace: config.inputMode === 'cards' });
    }

    function currentSurfaceRect() {
      if (surface && typeof surface.getBoundingClientRect === 'function') {
        const rect = surface.getBoundingClientRect();
        if (rect.width && rect.height) return rect;
      }
      return {
        left: 0,
        top: 0,
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0
      };
    }

    function completeTapCard() {
      if (!tapCard.suit || !tapCard.rank) return false;
      const value = profiles.formatCard(tapCard.rank, tapCard.suit, config.cardOutputFormat);
      tapCard = { suit: '', rank: '' };
      call(hooks.onSequence, { complete: true, stage: 'tapCard', value }, buffer);
      return commitValue(value, { replace: true });
    }

    function processTap(tap) {
      if (destroyed || config.inputMode !== 'tapzones') return;
      const zone = profiles.resolveTapZone(config.tapGrid, tap, currentSurfaceRect());
      if (!zone) return;
      const action = zone.action;
      call(hooks.onTapZone, zone, buffer);

      if (action.kind === 'empty') return;
      if (action.kind === 'append') {
        tapCard = { suit: '', rank: '' };
        commitValue(action.value);
        return;
      }
      if (action.kind === 'set') {
        tapCard = { suit: '', rank: '' };
        commitValue(action.value, { replace: true });
        return;
      }
      if (action.kind === 'suit' || action.kind === 'rank') {
        tapCard[action.kind] = action.value;
        if (!completeTapCard()) {
          clearSubmitTimer();
          const suit = profiles.SUITS_BY_ID[tapCard.suit];
          const preview = [tapCard.rank, suit?.emoji].filter(Boolean).join(' ');
          call(hooks.onSequence, { complete: false, stage: 'tapCard', preview }, buffer);
        }
        return;
      }
      if (action.kind === 'clear') {
        clear('tapZone');
        return;
      }
      if (action.kind === 'backspace') {
        tapCard = { suit: '', rank: '' };
        buffer = removeLastGrapheme(buffer);
        clearSubmitTimer();
        paint();
        if (buffer) {
          keepClipboardCurrent(buffer);
          armSubmitTimer();
        }
        return;
      }
      if (action.kind === 'submit') submit('tapZone');
    }

    function submit(reason = 'manual') {
      if (destroyed || !buffer) return false;

      const value = buffer;
      buffer = '';
      clearSubmitTimer();
      resetSequences();
      paint();

      if (config.clipboard && clipboardValue !== value) keepClipboardCurrent(value);

      let route = config.clipboard ? 'clipboard' : 'none';
      if (config.shortcutEnabled && config.shortcut) {
        route = 'shortcut';
        const url = `shortcuts://run-shortcut?name=${encodeURIComponent(config.shortcut)}&input=text&text=${encodeURIComponent(value)}`;
        try { window.location.assign(url); } catch (_) {}
      }
      if (config.postShortcut) {
        setTimeout(() => {
          try { window.location.assign(`shortcuts://run-shortcut?name=${encodeURIComponent(config.postShortcut)}`); } catch (_) {}
        }, 150);
      }

      call(hooks.onSubmit, value, route, reason);
      return true;
    }

    function clear(reason = 'manual') {
      if (destroyed) return;
      buffer = '';
      clearSubmitTimer();
      resetSequences();
      call(hooks.onClear, reason);
      paint();
    }

    function exitPerformance(reason) {
      if (destroyed) return;
      clear(reason);
      if (typeof hooks.onExit === 'function') call(hooks.onExit, reason);
      else {
        try { window.location.assign('settings.html'); } catch (_) {}
      }
    }

    gestureInput.onSwipe(processSwipe);
    if (config.inputMode === 'tapzones') {
      if (typeof gestureInput.onTap === 'function') gestureInput.onTap(processTap);
    } else {
      gestureInput.onDoubleTap(() => clear('doubleTap'));
    }
    gestureInput.onTwoFingerTap(() => submit('twoFingerTap'));
    gestureInput.onTwoFingerSwipe((gesture) => {
      if (gesture.direction === 'down') exitPerformance('twoFingerSwipeDown');
    });
    gestureInput.onTwoFingerHold(() => exitPerformance('twoFingerHold'));

    paint();

    return {
      config,
      submitNow: () => submit('api'),
      clear: () => clear('api'),
      getBuffer: () => buffer,
      getSequenceState: () => profileInput?.getState() || twoSwipeInput.getState(),
      getTapState: () => ({ ...tapCard }),
      destroy() {
        if (destroyed) return;
        clearSubmitTimer();
        twoSwipeInput.destroy();
        profileInput?.destroy();
        gestureInput.destroy();
        destroyed = true;
      }
    };
  }

  return Object.freeze({ CONFIG_VERSION, INPUT_MODES, DEFAULTS, normalizeConfig, copyText, start });
})();

if (typeof module === 'object' && module.exports) module.exports = Swipe;
