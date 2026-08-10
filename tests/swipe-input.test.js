'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ClockInput = require('../assets/js/clockInput.js');
const InputProfiles = require('../assets/js/inputProfiles.js');
const GestureDetector = require('../assets/js/gestureDetector.js');
const Swipe = require('../assets/js/swipe.js');
const Storage = require('../assets/js/storage.js');

function createTwoSwipeInput() {
  let nextTimer = 0;
  const timers = new Map();
  return new ClockInput.TwoSwipeInput({
    setTimer(callback) {
      nextTimer += 1;
      timers.set(nextTimer, callback);
      return nextTimer;
    },
    clearTimer(timer) { timers.delete(timer); }
  });
}

test('clock orientation keeps 12 at the top and advances clockwise', () => {
  assert.equal(ClockInput.vectorToClockPosition(0, -100), 12);
  assert.equal(ClockInput.vectorToClockPosition(50, -86.6), 1);
  assert.equal(ClockInput.vectorToClockPosition(100, 0), 3);
  assert.equal(ClockInput.vectorToClockPosition(0, 100), 6);
  assert.equal(ClockInput.vectorToClockPosition(-100, 0), 9);
  assert.equal(ClockInput.vectorToClockPosition(-50, -86.6), 11);
});

test('direct clock positions map only numeric sectors', () => {
  assert.equal(ClockInput.clockPositionToDigit(12), 0);
  for (let digit = 1; digit <= 9; digit += 1) {
    assert.equal(ClockInput.clockPositionToDigit(digit), digit);
  }
  assert.equal(ClockInput.clockPositionToDigit(10), null);
  assert.equal(ClockInput.clockPositionToDigit(11), null);
});

test('two-swipe clock combinations resolve every digit as documented', () => {
  const combinations = [
    ['up', 'left', 9], ['up', 'up', 0], ['up', 'right', 1],
    ['right', 'up', 2], ['right', 'right', 3], ['right', 'down', 4],
    ['down', 'right', 5], ['down', 'down', 6], ['down', 'left', 7],
    ['left', 'down', 8], ['left', 'left', 9], ['left', 'up', 0]
  ];

  combinations.forEach(([first, second, digit]) => {
    const input = createTwoSwipeInput();
    const pending = input.process(first);
    const result = input.process(second);
    assert.equal(pending.complete, false, `${first} should begin a pair`);
    assert.equal(result.complete, true, `${first} then ${second} should complete`);
    assert.equal(result.digit, digit, `${first} then ${second}`);
  });
});

test('an ambiguous opposite swipe restarts instead of entering a wrong digit', () => {
  const input = createTwoSwipeInput();
  input.process('up');
  const restarted = input.process('down');
  assert.equal(restarted.complete, false);
  assert.equal(restarted.restarted, true);
  assert.equal(restarted.firstDirection, 'down');

  const result = input.process('left');
  assert.equal(result.complete, true);
  assert.equal(result.digit, 7);
});

test('playing-card face resolves suit first and rank in one or two more swipes', () => {
  const compact = new InputProfiles.CardInput({ setTimer: () => 1, clearTimer() {} });
  assert.equal(compact.process('right').preview, '♥️');
  assert.equal(compact.process('up').complete, false);
  assert.deepEqual(
    compact.process('up'),
    {
      complete: true,
      stage: 'complete',
      value: 'A ♥️',
      rank: 'A',
      suit: InputProfiles.SUITS.right
    }
  );

  compact.process('left');
  const king = compact.process('left');
  assert.equal(king.complete, true);
  assert.equal(king.value, 'K ♣️');

  const words = new InputProfiles.CardInput({ format: 'words', setTimer: () => 1, clearTimer() {} });
  words.process('down');
  words.process('down');
  assert.equal(words.process('right').value, 'Ten of Diamonds');
});

test('custom faces map arbitrary outputs to two-direction combinations', () => {
  const face = InputProfiles.createBlankFace('Test face', 'test-face');
  face.map.up.right = 'hello';
  const input = new InputProfiles.CustomFaceInput(face, { setTimer: () => 1, clearTimer() {} });
  assert.equal(input.process('up').complete, false);
  assert.equal(input.process('right').value, 'hello');

  input.process('down');
  const restarted = input.process('up');
  assert.equal(restarted.complete, false);
  assert.equal(restarted.restarted, true);
  assert.equal(restarted.firstDirection, 'up');
});

test('tap maps resolve physical screen regions and preserve custom actions', () => {
  const grid = InputProfiles.normalizeTapGrid({
    rows: 2,
    columns: 2,
    zones: [
      { kind: 'append', value: '7' },
      { kind: 'suit', value: 'hearts' },
      { kind: 'rank', value: 'Q' },
      { kind: 'set', value: 'secret' }
    ]
  });
  const rect = { left: 10, top: 20, width: 200, height: 400 };
  assert.deepEqual(InputProfiles.resolveTapZone(grid, { x: 60, y: 70 }, rect).action, { kind: 'append', value: '7' });
  assert.deepEqual(InputProfiles.resolveTapZone(grid, { x: 160, y: 70 }, rect).action, { kind: 'suit', value: 'hearts' });
  assert.deepEqual(InputProfiles.resolveTapZone(grid, { x: 160, y: 300 }, rect).action, { kind: 'set', value: 'secret' });
  assert.equal(InputProfiles.resolveTapZone(grid, { x: 500, y: 500 }, rect), null);
});

test('two fast swipes never count as a double-tap', () => {
  let now = 0;
  let swipes = 0;
  let doubleTaps = 0;
  const detector = new GestureDetector({ now: () => now, minSwipeDistance: 30 });
  detector.onGesture(() => { swipes += 1; });
  detector.onDoubleTap(() => { doubleTaps += 1; });

  detector.pointerDown(1, 20, 100);
  now += 90;
  detector.pointerUp(1, 20, 20);
  now += 60;
  detector.pointerDown(2, 20, 100);
  now += 90;
  detector.pointerUp(2, 100, 100);

  assert.equal(swipes, 2);
  assert.equal(doubleTaps, 0);
});

test('two genuine taps still emit double-tap', () => {
  let now = 0;
  let doubleTaps = 0;
  const detector = new GestureDetector({ now: () => now });
  detector.onDoubleTap(() => { doubleTaps += 1; });

  detector.pointerDown(1, 50, 50);
  now += 60;
  detector.pointerUp(1, 52, 50);
  now += 100;
  detector.pointerDown(2, 51, 51);
  now += 60;
  detector.pointerUp(2, 50, 52);

  assert.equal(doubleTaps, 1);
});

test('quick two-finger tap emits submit gesture without hold', () => {
  let now = 0;
  let taps = 0;
  let holds = 0;
  const detector = new GestureDetector({ now: () => now });
  detector.onTwoFingerTap(() => { taps += 1; });
  detector.onTwoFingerHold(() => { holds += 1; });

  detector.pointerDown(1, 40, 50);
  now += 20;
  detector.pointerDown(2, 80, 50);
  now += 100;
  detector.pointerUp(1, 41, 50);
  detector.pointerUp(2, 79, 51);

  assert.equal(taps, 1);
  assert.equal(holds, 0);
});

test('two-finger hold emits exit gesture and cannot also submit', () => {
  let now = 0;
  let holdCallback = null;
  let taps = 0;
  let holds = 0;
  const detector = new GestureDetector({
    now: () => now,
    setTimer(callback) { holdCallback = callback; return 1; },
    clearTimer() { holdCallback = null; }
  });
  detector.onTwoFingerTap(() => { taps += 1; });
  detector.onTwoFingerHold(() => { holds += 1; });

  detector.pointerDown(1, 40, 50);
  now += 20;
  detector.pointerDown(2, 80, 50);
  now += 750;
  holdCallback();
  detector.pointerUp(1, 40, 50);
  detector.pointerUp(2, 80, 50);

  assert.equal(holds, 1);
  assert.equal(taps, 0);
});

test('two-finger downward swipe is distinct from tap and hold gestures', () => {
  let now = 0;
  let holdCallback = null;
  const swipes = [];
  let taps = 0;
  let holds = 0;
  const detector = new GestureDetector({
    now: () => now,
    setTimer(callback) { holdCallback = callback; return 1; },
    clearTimer() { holdCallback = null; }
  });
  detector.onTwoFingerSwipe((gesture) => { swipes.push(gesture.direction); });
  detector.onTwoFingerTap(() => { taps += 1; });
  detector.onTwoFingerHold(() => { holds += 1; });

  detector.pointerDown(1, 40, 40);
  now += 20;
  detector.pointerDown(2, 80, 40);
  now += 80;
  detector.pointerMove(1, 42, 115);
  detector.pointerMove(2, 79, 120);
  now += 40;
  detector.pointerUp(1, 42, 115);
  detector.pointerUp(2, 79, 120);

  assert.equal(holdCallback, null);
  assert.deepEqual(swipes, ['down']);
  assert.equal(taps, 0);
  assert.equal(holds, 0);
});

test('adding a second finger to an existing swipe cannot trigger submit or exit', () => {
  let holdCallback = null;
  let taps = 0;
  let holds = 0;
  let twoFingerSwipes = 0;
  const detector = new GestureDetector({
    setTimer(callback) { holdCallback = callback; return 1; },
    clearTimer() { holdCallback = null; }
  });
  detector.onTwoFingerTap(() => { taps += 1; });
  detector.onTwoFingerHold(() => { holds += 1; });
  detector.onTwoFingerSwipe(() => { twoFingerSwipes += 1; });

  detector.pointerDown(1, 20, 100);
  detector.pointerMove(1, 20, 40);
  detector.pointerDown(2, 80, 100);
  detector.pointerUp(1, 20, 40);
  detector.pointerUp(2, 80, 100);

  assert.equal(holdCallback, null);
  assert.equal(taps, 0);
  assert.equal(holds, 0);
  assert.equal(twoFingerSwipes, 0);
});

test('configuration migration enables automatic clipboard and preserves later opt-out', () => {
  const migrated = Swipe.normalizeConfig({ clipboard: false, useTwoSwipe: true });
  assert.equal(migrated.version, Swipe.CONFIG_VERSION);
  assert.equal(migrated.clipboard, true);
  assert.equal(migrated.inputMode, 'twoswipe');
  assert.equal(migrated.practiceMode, false);

  const versionTwoOptOut = Swipe.normalizeConfig({ version: 2, clipboard: false });
  assert.equal(versionTwoOptOut.clipboard, false);

  const current = Swipe.normalizeConfig({ version: Swipe.CONFIG_VERSION, clipboard: false, inputMode: 'clockface', practiceMode: true });
  assert.equal(current.clipboard, false);
  assert.equal(current.inputMode, 'clockface');
  assert.equal(current.practiceMode, true);
});

test('configuration saves Shortcut names and normalizes new input profiles', () => {
  const legacyShortcut = Swipe.normalizeConfig({ version: 3, shortcut: 'Card Reveal' });
  assert.deepEqual(legacyShortcut.shortcutNames, ['Card Reveal']);
  assert.equal(legacyShortcut.shortcutEnabled, true);

  const current = Swipe.normalizeConfig({
    version: Swipe.CONFIG_VERSION,
    shortcut: 'Numbers',
    shortcutNames: ['Numbers', 'Cards', 'numbers', ''],
    shortcutEnabled: false,
    inputMode: 'cards',
    cardOutputFormat: 'words',
    tapGrid: { rows: 99, columns: 1, zones: [] }
  });
  assert.deepEqual(current.shortcutNames, ['Numbers', 'Cards']);
  assert.equal(current.shortcutEnabled, false);
  assert.equal(current.inputMode, 'cards');
  assert.equal(current.cardOutputFormat, 'words');
  assert.equal(current.tapGrid.rows, 8);
  assert.equal(current.tapGrid.columns, 2);
});

test('legacy data URL wallpaper can be migrated to blob storage', () => {
  const blob = Storage.dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(blob.type, 'image/png');
  assert.equal(blob.size, 8);
});

test('instant wallpaper cache stores a synchronous first-paint image', async () => {
  const originalLocalStorage = global.localStorage;
  const originalSessionStorage = global.sessionStorage;
  const records = new Map();
  global.localStorage = {
    getItem(key) { return records.get(key) || null; },
    setItem(key, value) { records.set(key, value); },
    removeItem(key) { records.delete(key); }
  };
  global.sessionStorage = global.localStorage;

  try {
    const image = 'data:image/jpeg;base64,aW5zdGFudA==';
    assert.equal(await Storage.saveInstantImage('test.wallpaper', image), true);
    assert.equal(Storage.loadInstantImage('test.wallpaper'), image);
    assert.equal(Storage.deleteInstantImage('test.wallpaper'), true);
    assert.equal(Storage.loadInstantImage('test.wallpaper'), null);
  } finally {
    if (originalLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalLocalStorage;
    if (originalSessionStorage === undefined) delete global.sessionStorage;
    else global.sessionStorage = originalSessionStorage;
  }
});

test('performance markup keeps peeks unlabeled and avoids the iOS 100dvh trap', () => {
  const main = fs.readFileSync(require.resolve('../tricks/swipe/perform.html'), 'utf8');
  const contained = fs.readFileSync(require.resolve('../contained-swipe.html'), 'utf8');
  const baseCss = fs.readFileSync(require.resolve('../assets/css/base.css'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(require.resolve('../tricks/swipe/manifest.webmanifest'), 'utf8'));

  assert.doesNotMatch(main, /<div class="corner-peeks">\s*<[^>]+>\s*<span>/);
  assert.doesNotMatch(contained, /<div class="corner-peeks">\s*<[^>]+>\s*<span>/);
  assert.doesNotMatch(main, /height:\s*100dvh/);
  assert.doesNotMatch(baseCss, /-webkit-fill-available/);
  assert.equal(manifest.display, 'fullscreen');
});

test('shared engine copies the growing buffer as digits register and submits the final value', async () => {
  const originalGlobals = {
    ClockInput: global.ClockInput,
    Gestures: global.Gestures,
    Storage: global.Storage,
    document: global.document,
    navigator: global.navigator,
    window: global.window
  };
  const callbacks = {};
  const clipboardWrites = [];
  const submissions = [];
  const exits = [];

  global.ClockInput = ClockInput;
  global.Gestures = {
    create() {
      return {
        onSwipe(callback) { callbacks.swipe = callback; },
        onDoubleTap(callback) { callbacks.doubleTap = callback; },
        onTwoFingerTap(callback) { callbacks.twoFingerTap = callback; },
        onTwoFingerHold(callback) { callbacks.twoFingerHold = callback; },
        onTwoFingerSwipe(callback) { callbacks.twoFingerSwipe = callback; },
        destroy() { callbacks.destroyed = true; }
      };
    }
  };
  global.Storage = { load() { return {}; } };
  global.document = { body: null, getElementById() { return null; } };
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText(value) { clipboardWrites.push(value); return Promise.resolve(); } } }
  });
  global.window = { location: { assign() {} } };

  try {
    const engine = Swipe.start(
      { version: Swipe.CONFIG_VERSION, clipboard: true, inputMode: 'twoswipe', delay: 60 },
      {
        element: {},
        onSubmit(value, route) { submissions.push({ value, route }); },
        onExit(reason) { exits.push(reason); }
      }
    );

    callbacks.swipe(-90, { direction: 'up', deltaX: 0, deltaY: -80 });
    callbacks.swipe(-90, { direction: 'up', deltaX: 0, deltaY: -80 });
    await Promise.resolve();
    assert.equal(engine.getBuffer(), '0');
    assert.deepEqual(clipboardWrites, ['0']);

    callbacks.swipe(0, { direction: 'right', deltaX: 80, deltaY: 0 });
    callbacks.swipe(0, { direction: 'right', deltaX: 80, deltaY: 0 });
    await Promise.resolve();
    assert.equal(engine.getBuffer(), '03');
    assert.deepEqual(clipboardWrites, ['0', '03']);

    callbacks.twoFingerTap();
    assert.equal(engine.getBuffer(), '');
    assert.deepEqual(submissions, [{ value: '03', route: 'clipboard' }]);

    callbacks.twoFingerSwipe({ direction: 'right' });
    assert.deepEqual(exits, []);
    callbacks.twoFingerSwipe({ direction: 'down' });
    assert.deepEqual(exits, ['twoFingerSwipeDown']);
    engine.destroy();
    assert.equal(callbacks.destroyed, true);
  } finally {
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (key === 'navigator') {
        Object.defineProperty(global, key, { configurable: true, writable: true, value });
      } else if (value === undefined) {
        delete global[key];
      } else {
        global[key] = value;
      }
    }
  }
});

test('tap-zone mode accepts rapid taps without double-tap clearing', async () => {
  const originalGlobals = {
    ClockInput: global.ClockInput,
    InputProfiles: global.InputProfiles,
    Gestures: global.Gestures,
    Storage: global.Storage,
    document: global.document,
    navigator: global.navigator,
    window: global.window
  };
  const callbacks = {};
  const writes = [];
  const submissions = [];

  global.ClockInput = ClockInput;
  global.InputProfiles = InputProfiles;
  global.Gestures = {
    create() {
      return {
        onSwipe(callback) { callbacks.swipe = callback; },
        onTap(callback) { callbacks.tap = callback; },
        onDoubleTap(callback) { callbacks.doubleTap = callback; },
        onTwoFingerTap(callback) { callbacks.twoFingerTap = callback; },
        onTwoFingerHold(callback) { callbacks.twoFingerHold = callback; },
        onTwoFingerSwipe(callback) { callbacks.twoFingerSwipe = callback; },
        destroy() {}
      };
    }
  };
  global.Storage = { load() { return {}; } };
  global.document = { body: null, getElementById() { return null; } };
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText(value) { writes.push(value); return Promise.resolve(); } } }
  });
  global.window = { innerWidth: 100, innerHeight: 100, location: { assign() {} } };

  try {
    const engine = Swipe.start(
      {
        version: Swipe.CONFIG_VERSION,
        clipboard: true,
        inputMode: 'tapzones',
        delay: 60,
        tapGrid: {
          rows: 2,
          columns: 2,
          zones: [
            { kind: 'append', value: '1' },
            { kind: 'append', value: '2' },
            { kind: 'backspace', value: '' },
            { kind: 'submit', value: '' }
          ]
        }
      },
      {
        element: { getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; } },
        onSubmit(value, route) { submissions.push({ value, route }); }
      }
    );

    assert.equal(callbacks.doubleTap, undefined);
    callbacks.tap({ x: 25, y: 25 });
    callbacks.tap({ x: 75, y: 25 });
    await Promise.resolve();
    assert.equal(engine.getBuffer(), '12');
    assert.deepEqual(writes, ['1', '12']);

    callbacks.tap({ x: 25, y: 75 });
    await Promise.resolve();
    assert.equal(engine.getBuffer(), '1');
    callbacks.tap({ x: 75, y: 75 });
    assert.deepEqual(submissions, [{ value: '1', route: 'clipboard' }]);
    engine.destroy();
  } finally {
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (key === 'navigator') Object.defineProperty(global, key, { configurable: true, writable: true, value });
      else if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
});

test('wallpaper blobs save, load, and delete through IndexedDB storage', async () => {
  const originalIndexedDb = global.indexedDB;
  const originalLocalStorage = global.localStorage;
  const records = new Map();
  let storeCreated = false;

  const database = {
    objectStoreNames: { contains() { return storeCreated; } },
    createObjectStore() { storeCreated = true; },
    transaction() {
      const transaction = {
        error: null,
        objectStore() {
          return {
            put(record) {
              records.set(record.key, record);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = records.get(key);
                request.onsuccess?.();
              });
              return request;
            },
            delete(key) {
              records.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            }
          };
        }
      };
      return transaction;
    }
  };

  global.indexedDB = {
    open() {
      const request = { result: database };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
  global.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  try {
    const wallpaper = new Blob(['wallpaper'], { type: 'image/png' });
    const saved = await Storage.saveImage('test.wallpaper', wallpaper);
    assert.equal(saved.ok, true);
    assert.equal(saved.storage, 'indexeddb');

    const loaded = await Storage.loadImage('test.wallpaper');
    assert.equal(loaded.type, 'image/png');
    assert.equal(await loaded.text(), 'wallpaper');

    await Storage.deleteImage('test.wallpaper');
    assert.equal(await Storage.loadImage('test.wallpaper'), null);
  } finally {
    if (originalIndexedDb === undefined) delete global.indexedDB;
    else global.indexedDB = originalIndexedDb;
    if (originalLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalLocalStorage;
  }
});
