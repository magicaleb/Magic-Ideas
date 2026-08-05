/*
 * Shared clock-face math and two-swipe numeric input state.
 *
 * Screen coordinates use +x to the right and +y down. Clock degrees use
 * 0 degrees at 12 o'clock and increase clockwise.
 */
(function attachClockInput(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ClockInput = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createClockInput() {
  'use strict';

  const DIRECTIONS = Object.freeze(['up', 'right', 'down', 'left']);
  const ANCHOR_POSITIONS = Object.freeze({ up: 12, right: 3, down: 6, left: 9 });
  const ANCHOR_DIGITS = Object.freeze({ up: 0, right: 3, down: 6, left: 9 });

  // The second swipe points at the anchor digit or one of its visible
  // neighbours on a clock face. Opposite-direction pairs are intentionally
  // absent because they are ambiguous and should start a new pair instead.
  const TWO_SWIPE_DIGITS = Object.freeze({
    up: Object.freeze({ left: 9, up: 0, right: 1 }),
    right: Object.freeze({ up: 2, right: 3, down: 4 }),
    down: Object.freeze({ right: 5, down: 6, left: 7 }),
    left: Object.freeze({ down: 8, left: 9, up: 0 })
  });

  function normalizeDegrees(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return ((number % 360) + 360) % 360;
  }

  function screenAngleToDirection(angle) {
    const normalized = normalizeDegrees(angle);
    if (normalized === null) return null;
    if (normalized >= 315 || normalized < 45) return 'right';
    if (normalized < 135) return 'down';
    if (normalized < 225) return 'left';
    return 'up';
  }

  function vectorToDirection(deltaX, deltaY) {
    const x = Number(deltaX);
    const y = Number(deltaY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return null;
    return Math.abs(x) > Math.abs(y)
      ? (x > 0 ? 'right' : 'left')
      : (y > 0 ? 'down' : 'up');
  }

  function screenAngleToClockDegrees(angle) {
    const normalized = normalizeDegrees(angle);
    return normalized === null ? null : normalizeDegrees(normalized + 90);
  }

  function clockDegreesToPosition(clockDegrees) {
    const normalized = normalizeDegrees(clockDegrees);
    if (normalized === null) return null;
    const sector = Math.round(normalized / 30) % 12;
    return sector === 0 ? 12 : sector;
  }

  function screenAngleToClockPosition(angle) {
    return clockDegreesToPosition(screenAngleToClockDegrees(angle));
  }

  function vectorToClockPosition(deltaX, deltaY) {
    const x = Number(deltaX);
    const y = Number(deltaY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return null;

    // atan2(x, -y) makes straight up 0 degrees and increases clockwise.
    const clockDegrees = normalizeDegrees(Math.atan2(x, -y) * 180 / Math.PI);
    return clockDegreesToPosition(clockDegrees);
  }

  function clockPositionToDigit(position) {
    const value = Number(position);
    if (value === 12) return 0;
    return value >= 1 && value <= 9 && Number.isInteger(value) ? value : null;
  }

  function normalizeDirection(input) {
    if (typeof input === 'string') {
      return DIRECTIONS.includes(input) ? input : null;
    }

    if (typeof input === 'number') {
      return screenAngleToDirection(input);
    }

    if (!input || typeof input !== 'object') return null;
    if (DIRECTIONS.includes(input.direction)) return input.direction;
    if (Number.isFinite(input.deltaX) && Number.isFinite(input.deltaY)) {
      return vectorToDirection(input.deltaX, input.deltaY);
    }
    if (Number.isFinite(input.angle)) return screenAngleToDirection(input.angle);
    return null;
  }

  function resolveTwoSwipeDigit(firstInput, secondInput) {
    const first = normalizeDirection(firstInput);
    const second = normalizeDirection(secondInput);
    if (!first || !second) return null;
    return Object.prototype.hasOwnProperty.call(TWO_SWIPE_DIGITS[first], second)
      ? TWO_SWIPE_DIGITS[first][second]
      : null;
  }

  class TwoSwipeInput {
    constructor(options = {}) {
      this.timeoutMs = Math.max(250, Number(options.timeoutMs) || 3000);
      this.onTimeout = typeof options.onTimeout === 'function' ? options.onTimeout : null;
      this.setTimer = options.setTimer || setTimeout;
      this.clearTimer = options.clearTimer || clearTimeout;
      this.firstDirection = null;
      this.timer = null;
    }

    process(input) {
      const direction = normalizeDirection(input);
      if (!direction) {
        return { complete: false, invalid: true, ...this.getState() };
      }

      if (!this.firstDirection) {
        this.begin(direction);
        return {
          complete: false,
          stage: 'second',
          firstDirection: direction,
          anchorDigit: ANCHOR_DIGITS[direction],
          anchorPosition: ANCHOR_POSITIONS[direction]
        };
      }

      const firstDirection = this.firstDirection;
      const digit = resolveTwoSwipeDigit(firstDirection, direction);

      if (digit === null) {
        // An opposite swipe cannot select a neighbour. Treat it as a fresh
        // first swipe so a mistake never silently produces the wrong digit.
        this.begin(direction);
        return {
          complete: false,
          stage: 'second',
          restarted: true,
          invalidPair: [firstDirection, direction],
          firstDirection: direction,
          anchorDigit: ANCHOR_DIGITS[direction],
          anchorPosition: ANCHOR_POSITIONS[direction]
        };
      }

      this.reset();
      return {
        complete: true,
        stage: 'first',
        digit,
        position: digit === 0 ? 12 : digit,
        firstDirection,
        secondDirection: direction
      };
    }

    begin(direction) {
      this.cancelTimer();
      this.firstDirection = direction;
      this.timer = this.setTimer(() => {
        const expiredDirection = this.firstDirection;
        this.timer = null;
        this.firstDirection = null;
        if (this.onTimeout) this.onTimeout(expiredDirection);
      }, this.timeoutMs);
    }

    cancelTimer() {
      if (this.timer !== null) {
        this.clearTimer(this.timer);
        this.timer = null;
      }
    }

    reset() {
      this.cancelTimer();
      this.firstDirection = null;
    }

    destroy() {
      this.reset();
      this.onTimeout = null;
    }

    getState() {
      if (!this.firstDirection) {
        return { stage: 'first', firstDirection: null, anchorDigit: null, anchorPosition: null };
      }

      return {
        stage: 'second',
        firstDirection: this.firstDirection,
        anchorDigit: ANCHOR_DIGITS[this.firstDirection],
        anchorPosition: ANCHOR_POSITIONS[this.firstDirection]
      };
    }
  }

  return Object.freeze({
    DIRECTIONS,
    ANCHOR_POSITIONS,
    ANCHOR_DIGITS,
    TWO_SWIPE_DIGITS,
    normalizeDegrees,
    screenAngleToDirection,
    vectorToDirection,
    screenAngleToClockDegrees,
    clockDegreesToPosition,
    screenAngleToClockPosition,
    vectorToClockPosition,
    clockPositionToDigit,
    normalizeDirection,
    resolveTwoSwipeDigit,
    TwoSwipeInput
  });
});
