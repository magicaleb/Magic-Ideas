/* Directional output profiles shared by Swipe Input settings and performance. */
(function attachInputProfiles(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.InputProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createInputProfiles() {
  'use strict';

  const DIRECTIONS = Object.freeze(['up', 'right', 'down', 'left']);
  const DIRECTION_SYMBOLS = Object.freeze({ up: '↑', right: '→', down: '↓', left: '←' });
  const SUITS = Object.freeze({
    up: Object.freeze({ id: 'spades', emoji: '♠️', singular: 'Spade', plural: 'Spades' }),
    right: Object.freeze({ id: 'hearts', emoji: '♥️', singular: 'Heart', plural: 'Hearts' }),
    down: Object.freeze({ id: 'diamonds', emoji: '♦️', singular: 'Diamond', plural: 'Diamonds' }),
    left: Object.freeze({ id: 'clubs', emoji: '♣️', singular: 'Club', plural: 'Clubs' })
  });
  const SUITS_BY_ID = Object.freeze(Object.fromEntries(Object.values(SUITS).map((suit) => [suit.id, suit])));
  const RANK_GROUPS = Object.freeze({
    up: Object.freeze({ up: 'A', right: '2', down: '3', left: '4' }),
    right: Object.freeze({ up: '5', right: '6', down: '7', left: '8' }),
    down: Object.freeze({ up: '9', right: '10', down: 'J', left: 'Q' })
  });
  const RANK_WORDS = Object.freeze({
    A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
    8: 'Eight', 9: 'Nine', 10: 'Ten', J: 'Jack', Q: 'Queen', K: 'King'
  });
  const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);

  function isDirection(value) {
    return DIRECTIONS.includes(value);
  }

  function directionFrom(input) {
    if (isDirection(input)) return input;
    if (input && isDirection(input.direction)) return input.direction;
    return null;
  }

  function formatCard(rank, suitValue, format = 'compact') {
    const suit = typeof suitValue === 'string' ? SUITS_BY_ID[suitValue] : suitValue;
    if (!RANKS.includes(String(rank)) || !suit) return '';
    return format === 'words'
      ? `${RANK_WORDS[rank]} of ${suit.plural}`
      : `${rank} ${suit.emoji}`;
  }

  function makeEmptyMap() {
    return Object.fromEntries(DIRECTIONS.map((first) => [
      first,
      Object.fromEntries(DIRECTIONS.map((second) => [second, '']))
    ]));
  }

  function normalizeFace(face, index = 0) {
    const source = face && typeof face === 'object' ? face : {};
    const map = makeEmptyMap();
    DIRECTIONS.forEach((first) => {
      DIRECTIONS.forEach((second) => {
        map[first][second] = String(source.map?.[first]?.[second] ?? '').slice(0, 80);
      });
    });
    const fallbackId = `face-${index + 1}`;
    const rawId = String(source.id || fallbackId).trim().toLowerCase();
    const id = rawId.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallbackId;
    return {
      id,
      name: String(source.name || `Custom face ${index + 1}`).trim().slice(0, 48) || `Custom face ${index + 1}`,
      map
    };
  }

  function normalizeFaces(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, 12).map(normalizeFace).map((face, index) => {
      let id = face.id;
      let suffix = index + 1;
      while (seen.has(id)) {
        id = `${face.id}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      return { ...face, id };
    });
  }

  function createBlankFace(name = 'My clock face', id = `face-${Date.now().toString(36)}`) {
    return normalizeFace({ id, name, map: makeEmptyMap() });
  }

  function emptyAction() {
    return { kind: 'empty', value: '' };
  }

  function normalizeTapAction(action) {
    const source = action && typeof action === 'object' ? action : {};
    const allowed = ['empty', 'append', 'set', 'suit', 'rank', 'clear', 'backspace', 'submit'];
    const kind = allowed.includes(source.kind) ? source.kind : 'empty';
    let value = String(source.value ?? '').slice(0, 80);
    if (kind === 'suit' && !SUITS_BY_ID[value]) return emptyAction();
    if (kind === 'rank' && !RANKS.includes(value)) return emptyAction();
    if (['empty', 'clear', 'backspace', 'submit'].includes(kind)) value = '';
    if (['append', 'set'].includes(kind) && !value) return emptyAction();
    return { kind, value };
  }

  function normalizeTapGrid(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rows = Math.min(8, Math.max(2, Math.round(Number(source.rows) || 6)));
    const columns = Math.min(5, Math.max(2, Math.round(Number(source.columns) || 4)));
    const size = rows * columns;
    const supplied = Array.isArray(source.zones) ? source.zones : [];
    const zones = Array.from({ length: size }, (_, index) => normalizeTapAction(supplied[index]));
    return { rows, columns, zones };
  }

  function defaultTapGrid(preset = 'numbers') {
    if (preset === 'cards') {
      const grid = normalizeTapGrid({ rows: 6, columns: 4 });
      ['spades', 'hearts', 'diamonds', 'clubs'].forEach((value, index) => {
        grid.zones[index] = { kind: 'suit', value };
      });
      RANKS.forEach((value, index) => {
        grid.zones[index + 4] = { kind: 'rank', value };
      });
      grid.zones[21] = { kind: 'backspace', value: '' };
      grid.zones[22] = { kind: 'clear', value: '' };
      grid.zones[23] = { kind: 'submit', value: '' };
      return grid;
    }

    if (preset === 'blank') return normalizeTapGrid({ rows: 6, columns: 4 });

    const grid = normalizeTapGrid({ rows: 6, columns: 4 });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((value, index) => {
      grid.zones[index] = { kind: 'append', value };
    });
    grid.zones[10] = { kind: 'backspace', value: '' };
    grid.zones[11] = { kind: 'submit', value: '' };
    grid.zones[23] = { kind: 'clear', value: '' };
    return grid;
  }

  function tapActionLabel(action, verbose = false) {
    const normalized = normalizeTapAction(action);
    if (normalized.kind === 'empty') return verbose ? 'Unused' : '·';
    if (normalized.kind === 'suit') return SUITS_BY_ID[normalized.value]?.emoji || '·';
    if (normalized.kind === 'rank') return normalized.value;
    if (normalized.kind === 'clear') return verbose ? 'Clear' : '×';
    if (normalized.kind === 'backspace') return verbose ? 'Backspace' : '⌫';
    if (normalized.kind === 'submit') return verbose ? 'Submit' : '↵';
    return normalized.value;
  }

  function resolveTapZone(gridValue, tap, rectValue) {
    const grid = normalizeTapGrid(gridValue);
    const rect = rectValue || { left: 0, top: 0, width: 0, height: 0 };
    const width = Number(rect.width) || 0;
    const height = Number(rect.height) || 0;
    if (!tap || width <= 0 || height <= 0) return null;
    const relativeX = Number(tap.x) - (Number(rect.left) || 0);
    const relativeY = Number(tap.y) - (Number(rect.top) || 0);
    if (relativeX < 0 || relativeY < 0 || relativeX >= width || relativeY >= height) return null;
    const column = Math.min(grid.columns - 1, Math.floor(relativeX / width * grid.columns));
    const row = Math.min(grid.rows - 1, Math.floor(relativeY / height * grid.rows));
    const index = row * grid.columns + column;
    return { index, row, column, action: grid.zones[index] };
  }

  class TimedDirectionalInput {
    constructor(options = {}) {
      this.timeoutMs = Math.max(500, Number(options.timeoutMs) || 3000);
      this.onTimeout = typeof options.onTimeout === 'function' ? options.onTimeout : () => {};
      this.setTimer = options.setTimer || setTimeout;
      this.clearTimer = options.clearTimer || clearTimeout;
      this.timer = null;
    }

    cancelTimer() {
      if (this.timer !== null) this.clearTimer(this.timer);
      this.timer = null;
    }

    armTimer() {
      this.cancelTimer();
      this.timer = this.setTimer(() => {
        this.timer = null;
        const previous = this.getState();
        this.reset(false);
        this.onTimeout(previous);
      }, this.timeoutMs);
    }

    destroy() {
      this.cancelTimer();
      this.reset(false);
    }
  }

  class CardInput extends TimedDirectionalInput {
    constructor(options = {}) {
      super(options);
      this.format = options.format === 'words' ? 'words' : 'compact';
      this.reset(false);
    }

    reset(cancelTimer = true) {
      if (cancelTimer) this.cancelTimer();
      this.stage = 'suit';
      this.suitDirection = null;
      this.rankGroup = null;
    }

    getState() {
      return { stage: this.stage, suitDirection: this.suitDirection, rankGroup: this.rankGroup };
    }

    process(input) {
      const direction = directionFrom(input);
      if (!direction) return { complete: false, stage: this.stage, ignored: true };

      if (this.stage === 'suit') {
        this.suitDirection = direction;
        this.stage = 'rank';
        this.armTimer();
        return {
          complete: false,
          stage: 'rank',
          suit: SUITS[direction],
          preview: SUITS[direction].emoji,
          message: 'Suit registered; choose the rank'
        };
      }

      if (this.stage === 'rank') {
        if (direction === 'left') return this.complete('K');
        this.rankGroup = direction;
        this.stage = 'rankDetail';
        this.armTimer();
        return {
          complete: false,
          stage: 'rankDetail',
          suit: SUITS[this.suitDirection],
          rankGroup: direction,
          preview: `${SUITS[this.suitDirection].emoji}·`,
          message: 'Rank group registered; choose the value'
        };
      }

      const rank = RANK_GROUPS[this.rankGroup]?.[direction];
      if (!rank) {
        this.reset();
        return { complete: false, stage: 'suit', restarted: true };
      }
      return this.complete(rank);
    }

    complete(rank) {
      const suit = SUITS[this.suitDirection];
      const value = formatCard(rank, suit, this.format);
      this.reset();
      return { complete: true, stage: 'complete', value, rank, suit };
    }
  }

  class CustomFaceInput extends TimedDirectionalInput {
    constructor(face, options = {}) {
      super(options);
      this.face = normalizeFace(face);
      this.reset(false);
    }

    reset(cancelTimer = true) {
      if (cancelTimer) this.cancelTimer();
      this.firstDirection = null;
    }

    getState() {
      return { stage: this.firstDirection ? 'second' : 'first', firstDirection: this.firstDirection };
    }

    process(input) {
      const direction = directionFrom(input);
      if (!direction) return { complete: false, stage: this.getState().stage, ignored: true };
      if (!this.firstDirection) {
        this.firstDirection = direction;
        this.armTimer();
        return { complete: false, stage: 'second', firstDirection: direction, preview: DIRECTION_SYMBOLS[direction] };
      }

      const firstDirection = this.firstDirection;
      const value = this.face.map[firstDirection]?.[direction] || '';
      if (!value) {
        this.firstDirection = direction;
        this.armTimer();
        return { complete: false, stage: 'second', firstDirection: direction, restarted: true, preview: DIRECTION_SYMBOLS[direction] };
      }

      this.reset();
      return { complete: true, stage: 'complete', firstDirection, secondDirection: direction, value };
    }
  }

  return Object.freeze({
    DIRECTIONS,
    DIRECTION_SYMBOLS,
    SUITS,
    SUITS_BY_ID,
    RANKS,
    RANK_GROUPS,
    formatCard,
    normalizeFace,
    normalizeFaces,
    createBlankFace,
    normalizeTapAction,
    normalizeTapGrid,
    defaultTapGrid,
    tapActionLabel,
    resolveTapZone,
    CardInput,
    CustomFaceInput
  });
});
