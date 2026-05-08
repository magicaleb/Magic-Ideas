(() => {
  'use strict';

  const STACK = [
    'AH','KS','AD','KC','2H','QS','2D','QC','3H','JS','3D','JC','4H','TS','4D','TC',
    '5H','9S','5D','9C','6H','8S','6D','8C','7H','7S','7D','7C','8H','6S','8D','6C',
    '9H','5S','9D','5C','TH','4S','TD','4C','JH','3S','JD','3C','QH','2S','QD','2C',
    'KH','AS','KD','AC'
  ];

  const SUIT_SYMBOL  = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const RANK_DISPLAY = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10' };
  const RED_SUITS    = new Set(['H', 'D']);

  function parseCard(code) {
    const rank  = RANK_DISPLAY[code[0]] ?? code[0];
    const suit  = SUIT_SYMBOL[code[1]]  ?? code[1];
    const isRed = RED_SUITS.has(code[1]);
    return { rank, suit, isRed };
  }

  /* ── Drill stats ─────────────────────────────────────────────── */
  const state = {
    mode: null,
    currentPrompt: null,
    startedAt: 0,
    stats: loadStats(),
    sessionCorrect: 0,
    sessionTotal: 0,
    currentStreak: 0,
  };

  function loadStats() {
    const defaults = { attempts: 0, correct: 0, totalMs: 0, bestStreak: 0, missed: {} };
    try {
      const raw = localStorage.getItem('stackSprintStats');
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch { return defaults; }
  }

  function persistStats() {
    localStorage.setItem('stackSprintStats', JSON.stringify(state.stats));
  }

  /* ── SRS engine ──────────────────────────────────────────────── */
  // srs[idx] = { interval: days (0=learning), due: epochMs }
  // Interval ladder: 0 (learning) → 1 → 3 → 7 → 14 → 30

  const SRS_KEY              = 'stackMemorizeSRS';
  const SRS_INTERVALS        = [1, 3, 7, 14, 30]; // days
  const MS_PER_DAY           = 86_400_000;
  const DEFAULT_CHUNK_SIZE   = 10;
  const MAX_DUE_PER_SESSION  = 8;
  const RECALL_TOO_SLOW_MS    = 2500;
  const QUARTER_DECK_OFFSET   = 13;
  const AUTO_SUBMIT_DELAY_MS = 900;
  const TWO_DIGIT_AUTO_SUBMIT_DELAY_MS = 1800;
  const HIDE_PATTERN_BOTH = 0;
  const HIDE_PATTERN_CARD = 1;
  const HIDE_PATTERN_NUM = 2;
  const HIDE_PATTERN_CARD_AGAIN = 3;
  const IMPRINT_PATTERN_ALTERNATING = [HIDE_PATTERN_BOTH, HIDE_PATTERN_CARD, HIDE_PATTERN_NUM, HIDE_PATTERN_CARD_AGAIN];
  const IMPRINT_PATTERN_BALANCED = [HIDE_PATTERN_BOTH, HIDE_PATTERN_CARD, HIDE_PATTERN_NUM, HIDE_PATTERN_BOTH];
  const DEFAULT_MEM_SETTINGS = { randomizeOrder: false, altHide: true, earlyRetest: true, bothDirections: false };

  function loadSRS() {
    try { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveSRS(data) {
    localStorage.setItem(SRS_KEY, JSON.stringify(data));
  }

  function srsNextInterval(cur) {
    if (!cur) return 1;
    const i = SRS_INTERVALS.indexOf(cur);
    return i === -1 ? 1 : (i < SRS_INTERVALS.length - 1 ? SRS_INTERVALS[i + 1] : 30);
  }

    function srsGotIt(srs, idx) {
    const cur         = srs[idx];
    const newInterval = srsNextInterval(cur ? cur.interval : 0);
    srs[idx] = { interval: newInterval, due: Date.now() + newInterval * MS_PER_DAY };
  }

    function srsGraduatedCount() {
    const srs = loadSRS();
    return STACK.filter((_, i) => srs[i] && srs[i].interval >= 1).length;
  }

  function srsDueCount() {
    const srs = loadSRS();
    const now = Date.now();
    return STACK.filter((_, i) => srs[i] && srs[i].due <= now).length;
  }

  function srsNewCount() {
    const srs = loadSRS();
    return STACK.filter((_, i) => !srs[i]).length;
  }

  function buildSessionQueue(srs, chunkSize, randomizeOrder, deckOrder) {
    const now = Date.now();

    const due = STACK
      .map((_, i) => ({ idx: i, due: srs[i] ? srs[i].due : Infinity }))
      .filter(c => srs[c.idx] && c.due <= now)
      .sort((a, b) => a.due - b.due)
      .slice(0, Math.min(MAX_DUE_PER_SESSION, chunkSize))
      .map(c => c.idx);

    const remaining = chunkSize - due.length;

    // Use pre-shuffled deckOrder if provided (global randomize), otherwise sequential
    let newCardsCandidates;
    if (deckOrder) {
      newCardsCandidates = deckOrder.filter(i => !srs[i]);
    } else {
      newCardsCandidates = STACK.map((_, i) => i).filter(i => !srs[i]);
    }
    const newCards = newCardsCandidates.slice(0, remaining);

    // Interleave due and new cards for varied retrieval practice
    const combined = [];
    const len = Math.max(due.length, newCards.length);
    for (let i = 0; i < len; i++) {
      if (i < due.length)      combined.push(due[i]);
      if (i < newCards.length) combined.push(newCards[i]);
    }
    return randomizeOrder ? shuffleInPlace(combined) : combined;
  }
  function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }


  /* ── Memorize session state ──────────────────────────────────── */
  const memSess = {
    srs: null,
    batchSize: 5,
    currentBatchCards: [],  // card indices in the active batch
    isRepeatBatch: false,   // true when repeating without SRS updates
    deckOrder: null,        // shuffled new-card order for full-deck randomize (null = sequential)

    // Flat task queue for the current phase
    taskQueue: [],
    currentTask: null,

    inBatchRetest: false,
    batchRetestPassed: new Set(),
    batchSrsCredited: new Set(),

    goodCount: 0,           // total "Got it" across all batches (for complete screen)
  };

  const MEM_SETTINGS_KEY = 'stackMemorizeSettings';
  function loadMemSettings() {
    try {
      const raw = localStorage.getItem(MEM_SETTINGS_KEY);
      return raw ? { ...DEFAULT_MEM_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_MEM_SETTINGS };
    } catch {
      return { ...DEFAULT_MEM_SETTINGS };
    }
  }
  function saveMemSettings() {
    localStorage.setItem(MEM_SETTINGS_KEY, JSON.stringify(memSettings));
  }
  const memSettings = loadMemSettings();

  /* ── DOM references ──────────────────────────────────────────── */
  const els = {
    modeGrid:           document.getElementById('modeGrid'),
    quizSetup:          document.getElementById('quizSetup'),
    trainer:            document.getElementById('trainer'),
    memorize:           document.getElementById('memorize'),
    stats:              document.getElementById('stats'),
    streakChip:         document.getElementById('streakChip'),
    masteryFill:        null,
    masteryText:        null,
    btnBack:            document.getElementById('btnBack'),
    btnBackQuizSetup:   document.getElementById('btnBackQuizSetup'),
    btnStartQuiz:       document.getElementById('btnStartQuiz'),
    btnBackStats:       document.getElementById('btnBackStats'),
    scoreline:          document.getElementById('scoreline'),
    questionLabel:      document.getElementById('questionLabel'),
    questionDisplay:    document.getElementById('questionDisplay'),
    questionPrefix:     document.getElementById('questionPrefix'),
    questionValue:      document.getElementById('questionValue'),
    questionSuit:       document.getElementById('questionSuit'),
    questionTimer:      document.getElementById('questionTimer'),
    timerValue:         document.getElementById('timerValue'),
    distDisplay:        document.getElementById('distDisplay'),
    distItemA:          document.getElementById('distItemA'),
    distItemB:          document.getElementById('distItemB'),
    distSep:            document.getElementById('distSep'),
    answerForm:         document.getElementById('answerForm'),
    answerInput:        document.getElementById('answerInput'),
    answerLabel:        document.getElementById('answerLabel'),
    feedback:           document.getElementById('feedback'),
    btnReveal:          document.getElementById('btnReveal'),
    btnNext:            document.getElementById('btnNext'),
    statAttempts:       document.getElementById('statAttempts'),
    statAccuracy:       document.getElementById('statAccuracy'),
    statSpeed:          document.getElementById('statSpeed'),
    statBestStreak:     document.getElementById('statBestStreak'),
    statDue:            document.getElementById('statDue'),
    weakList:           document.getElementById('weakList'),
    btnReset:           document.getElementById('btnReset'),
    // Keypads
    cardKeypad:         document.getElementById('cardKeypad'),
    numKeypad:          document.getElementById('numKeypad'),
    dispRank:           document.getElementById('dispRank'),
    dispSuit:           document.getElementById('dispSuit'),
    numDisplay:         document.getElementById('numDisplay'),
    cardClear:          document.getElementById('cardClear'),
    numClear:           document.getElementById('numClear'),
    numBack:            document.getElementById('numBack'),
    // Quiz settings
    quizSettings:           document.getElementById('quizSettings'),
    quizSettingsSummary:    document.getElementById('quizSettingsSummary'),
    quizSettingsBody:       document.getElementById('quizSettingsBody'),
    qsPosMin:               document.getElementById('qsPosMin'),
    qsPosMax:               document.getElementById('qsPosMax'),
    qsRangeDisplay:         document.getElementById('qsRangeDisplay'),
    qsTimed:                document.getElementById('qsTimed'),
    // Memorize
    memModeBadge:       document.getElementById('memModeBadge'),
    memPicker:          document.getElementById('memPicker'),
    memSession:         document.getElementById('memSession'),
    memBatchComplete:   document.getElementById('memBatchComplete'),
    memComplete:        document.getElementById('memComplete'),
    btnBackMemorize:    document.getElementById('btnBackMemorize'),
    memInfoDue:         document.getElementById('memInfoDue'),
    memInfoNew:         document.getElementById('memInfoNew'),
    memBtnStart:        document.getElementById('memBtnStart'),
    // Pair tiles
    memPair:            document.getElementById('memPair'),
    memTileNum:         document.getElementById('memTileNum'),
    memTileCard:        document.getElementById('memTileCard'),
    memTileNumText:     document.getElementById('memTileNumText'),
    pcMainRank:         document.getElementById('pcMainRank'),
    pcMainSuit:         document.getElementById('pcMainSuit'),
    memPhaseLabel:      document.getElementById('memPhaseLabel'),
    memStepDots:        document.getElementById('memStepDots'),
    // Action buttons
    memBtnAdvance:      document.getElementById('memBtnAdvance'),
    memBtnRevealRetest: document.getElementById('memBtnRevealRetest'),
    memRetestBtns:      document.getElementById('memRetestBtns'),
    memBtnMiss:         document.getElementById('memBtnMiss'),
    memBtnGotIt:        document.getElementById('memBtnGotIt'),
    // Counters / progress
    memProgressFill:    document.getElementById('memProgressFill'),
    memCountDone:       document.getElementById('memCountDone'),
    memCountTotal:      document.getElementById('memCountTotal'),
    btnBackSession:     document.getElementById('btnBackSession'),
    // Batch complete
    memBatchCompleteSub:  document.getElementById('memBatchCompleteSub'),
    memBtnRepeatBatch:    document.getElementById('memBtnRepeatBatch'),
    memBtnNextBatch:      document.getElementById('memBtnNextBatch'),
    btnBackBatchComplete: document.getElementById('btnBackBatchComplete'),
    // Session complete
    memCompleteTrophy:  document.getElementById('memCompleteTrophy'),
    memCompleteSub:     document.getElementById('memCompleteSub'),
    memCompleteStats:   document.getElementById('memCompleteStats'),
    memBtnStudyMore:    document.getElementById('memBtnStudyMore'),
    btnBackMemComplete: document.getElementById('btnBackMemComplete'),
    // Picker settings
    memChunkSize:       document.getElementById('memChunkSize'),
    memChunkSizeValue:  document.getElementById('memChunkSizeValue'),
    memRandomizeOrder:  document.getElementById('memRandomizeOrder'),
    memAltHide:         document.getElementById('memAltHide'),
    memEarlyRetest:     document.getElementById('memEarlyRetest'),
    memBothDirections:  document.getElementById('memBothDirections'),
  };

  // Keypad selection state
  const cardSel = { rank: null, suit: null };
  let numVal = '';
  let numAutoSubmitTimer = null;
  let answerLocked = false;

  /* ── Quiz filters state ──────────────────────────────────────── */
  const QF_KEY = 'stackQuizFilters';
  function loadQuizFilters() {
    const defaults = { mode: 'mixed', color: 'all', suit: 'all', parity: 'all', posMin: 1, posMax: 52, timed: true };
    try {
      const raw = localStorage.getItem(QF_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch { return defaults; }
  }
  function saveQuizFilters() {
    localStorage.setItem(QF_KEY, JSON.stringify(quizFilters));
  }
  const quizFilters = loadQuizFilters();

  /* ── Timer ──────────────────────────────────────────────────── */
  const timer = setInterval(() => {
    if (!state.startedAt || els.trainer.classList.contains('hidden')) return;
    const seconds = (performance.now() - state.startedAt) / 1000;
    els.timerValue.textContent = `${seconds.toFixed(1)}s`;
  }, 80);

  /* ── Helpers ─────────────────────────────────────────────────── */
  function normalizeCard(value) {
    return value.trim().toUpperCase().replace('10', 'T');
  }

  /* ── UI updates ─────────────────────────────────────────────── */
  function updateStreakChip() {
    els.streakChip.textContent = `${state.currentStreak} 🔥`;
    els.streakChip.classList.remove('bump');
    void els.streakChip.offsetWidth;
    els.streakChip.classList.add('bump');
  }

  function updateMasteryBar() { /* mastery bar removed */ }

  function updateTopStatsUI() {
    const pct = state.sessionTotal
      ? Math.round((state.sessionCorrect / state.sessionTotal) * 100) : 0;
    els.scoreline.textContent = `${state.sessionCorrect} / ${state.sessionTotal} • ${pct}%`;
    updateStreakChip();
  }

  function updateMemModeBadge() {
    const due = srsDueCount();
    if (due > 0) {
      els.memModeBadge.textContent = `${due} due`;
      els.memModeBadge.classList.remove('hidden');
    } else {
      els.memModeBadge.classList.add('hidden');
    }
  }

  /* ── Views ───────────────────────────────────────────────────── */
  function setView(name) {
    els.modeGrid.classList.toggle('hidden',   name !== 'modes');
    els.quizSetup.classList.toggle('hidden',  name !== 'quiz-setup');
    els.trainer.classList.toggle('hidden',    name !== 'trainer');
    els.memorize.classList.toggle('hidden',   name !== 'memorize');
    els.stats.classList.toggle('hidden',      name !== 'stats');
  }

  function setMemView(name) {
    els.memPicker.classList.toggle('hidden',        name !== 'picker');
    els.memSession.classList.toggle('hidden',       name !== 'session');
    els.memBatchComplete.classList.toggle('hidden', name !== 'batch-complete');
    els.memComplete.classList.toggle('hidden',      name !== 'complete');
  }

  /* ── Drill prompt logic ──────────────────────────────────────── */
  function showQuestionAsNumber(num) {
    els.questionDisplay.classList.remove('hidden');
    els.distDisplay.classList.add('hidden');
    els.questionLabel.textContent    = 'Position';
    els.questionPrefix.textContent   = '#';
    els.questionPrefix.style.display = '';
    els.questionValue.textContent    = String(num);
    els.questionValue.classList.remove('is-red');
    els.questionSuit.classList.add('hidden');
    els.answerLabel.textContent      = 'Select the card at this position';
    els.cardKeypad.classList.remove('hidden');
    els.numKeypad.classList.add('hidden');
  }

  function showQuestionAsCard(code) {
    els.questionDisplay.classList.remove('hidden');
    els.distDisplay.classList.add('hidden');
    const { rank, suit, isRed } = parseCard(code);
    els.questionLabel.textContent    = 'Card';
    els.questionPrefix.style.display = 'none';
    els.questionValue.textContent    = rank;
    els.questionValue.classList.toggle('is-red', isRed);
    els.questionSuit.textContent     = suit;
    els.questionSuit.className       = `question-suit ${isRed ? 'is-red' : 'is-black'}`;
    els.answerLabel.textContent      = 'Enter position  (1–52)';
    els.cardKeypad.classList.add('hidden');
    els.numKeypad.classList.remove('hidden');
  }

  function showQuestionAsCardCue(code, label, answerLabel) {
    els.questionDisplay.classList.remove('hidden');
    els.distDisplay.classList.add('hidden');
    const { rank, suit, isRed } = parseCard(code);
    els.questionLabel.textContent    = label;
    els.questionPrefix.style.display = 'none';
    els.questionValue.textContent    = rank;
    els.questionValue.classList.toggle('is-red', isRed);
    els.questionSuit.textContent     = suit;
    els.questionSuit.className       = `question-suit ${isRed ? 'is-red' : 'is-black'}`;
    els.answerLabel.textContent      = answerLabel;
    els.cardKeypad.classList.remove('hidden');
    els.numKeypad.classList.add('hidden');
  }

  function weightedRandomPrompt(direction) {
    const pool = STACK.map((card, idx) => {
      const key    = `${idx + 1}:${card}`;
      const misses = state.stats.missed[key] || 0;
      const weight = Math.max(1, misses * 1.8);
      return { idx, card, weight };
    });

    const totalWeight = pool.reduce((s, item) => s + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) {
        return direction === 'number-to-card'
          ? { ask: String(item.idx + 1), answer: item.card, direction, key: `${item.idx + 1}:${item.card}` }
          : { ask: item.card, answer: String(item.idx + 1), direction, key: `${item.idx + 1}:${item.card}` };
      }
    }
    return { ask: '1', answer: 'AH', direction: 'number-to-card', key: '1:AH' };
  }

  /* ── Quiz filter helpers ─────────────────────────────────────── */
  function getFilteredPool() {
    return STACK
      .map((card, idx) => ({ card, idx, pos: idx + 1 }))
      .filter(({ card, pos }) => {
        const suit  = card[1];
        const isRed = RED_SUITS.has(suit);
        if (quizFilters.color === 'red'   && !isRed)  return false;
        if (quizFilters.color === 'black' && isRed)   return false;
        if (quizFilters.suit !== 'all' && suit !== quizFilters.suit) return false;
        if (quizFilters.parity === 'odd'  && pos % 2 === 0) return false;
        if (quizFilters.parity === 'even' && pos % 2 !== 0) return false;
        if (pos < quizFilters.posMin || pos > quizFilters.posMax) return false;
        return true;
      });
  }

  function weightedRandomPromptFiltered(direction) {
    let pool = getFilteredPool();
    if (!pool.length) pool = STACK.map((card, idx) => ({ card, idx, pos: idx + 1 })); // fallback

    const weighted = pool.map(({ card, idx }) => {
      const key    = `${idx + 1}:${card}`;
      const misses = state.stats.missed[key] || 0;
      const weight = Math.max(1, misses * 1.8);
      return { idx, card, weight };
    });

    let dir = direction;
    if (dir === 'mixed') dir = Math.random() < 0.5 ? 'number-to-card' : 'card-to-number';

    const totalWeight = weighted.reduce((s, item) => s + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return dir === 'number-to-card'
          ? { ask: String(item.idx + 1), answer: item.card, direction: dir, key: `${item.idx + 1}:${item.card}` }
          : { ask: item.card, answer: String(item.idx + 1), direction: dir, key: `${item.idx + 1}:${item.card}` };
      }
    }
    const item = weighted[0];
    return dir === 'number-to-card'
      ? { ask: String(item.idx + 1), answer: item.card, direction: dir, key: `${item.idx + 1}:${item.card}` }
      : { ask: item.card, answer: String(item.idx + 1), direction: dir, key: `${item.idx + 1}:${item.card}` };
  }

  /* ── Distance quiz ───────────────────────────────────────────── */
  function cardItemHTML(code) {
    const { rank, suit, isRed } = parseCard(code);
    return `<span class="dist-card-val ${isRed ? 'is-red' : 'is-black'}">${rank}${suit}</span>`;
  }

  function showDistCardGap(idxA, idxB) {
    els.questionDisplay.classList.add('hidden');
    els.distDisplay.classList.remove('hidden');
    els.distSep.textContent = '↔';
    els.distItemA.innerHTML = cardItemHTML(STACK[idxA]);
    els.distItemB.innerHTML = cardItemHTML(STACK[idxB]);
    els.questionLabel.textContent = 'Distance Quiz';
    els.answerLabel.textContent   = 'How many positions apart?';
    els.cardKeypad.classList.add('hidden');
    els.numKeypad.classList.remove('hidden');
  }

  function showDistCardJump(idxA, offset) {
    els.questionDisplay.classList.add('hidden');
    els.distDisplay.classList.remove('hidden');
    const sign = offset > 0 ? `+${offset}` : String(offset);
    els.distSep.textContent = '';
    els.distItemA.innerHTML = cardItemHTML(STACK[idxA]);
    els.distItemB.innerHTML = `<span class="dist-offset">${sign}</span>`;
    els.questionLabel.textContent = 'Distance Quiz';
    els.answerLabel.textContent   = 'Which card is there?';
    els.cardKeypad.classList.remove('hidden');
    els.numKeypad.classList.add('hidden');
  }

  function nextDistancePrompt() {
    let pool = getFilteredPool();
    if (pool.length < 2) pool = STACK.map((card, idx) => ({ card, idx, pos: idx + 1 }));

    const distMode = Math.random() < 0.5 ? 'card-gap' : 'card-jump';

    if (distMode === 'card-gap') {
      const a = pool[Math.floor(Math.random() * pool.length)];
      let b;
      do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b.idx === a.idx);
      const distance = Math.abs(a.idx - b.idx);
      state.currentPrompt = {
        direction: 'distance', distMode: 'card-gap',
        idxA: a.idx, idxB: b.idx,
        answer: String(distance),
        key: `dist:${Math.min(a.idx, b.idx)}:${Math.max(a.idx, b.idx)}`,
      };
      showDistCardGap(a.idx, b.idx);
    } else {
      const a = pool[Math.floor(Math.random() * pool.length)];
      const offsets = [];
      // ±13 limit keeps distance meaningful while covering a quarter-deck span
      for (let o = -13; o <= 13; o++) {
        if (o === 0) continue;
        const t = a.idx + o;
        if (t >= 0 && t < 52) offsets.push(o);
      }
      if (!offsets.length) { nextDistancePrompt(); return; }
      const offset = offsets[Math.floor(Math.random() * offsets.length)];
      const idxB   = a.idx + offset;
      state.currentPrompt = {
        direction: 'distance', distMode: 'card-jump',
        idxA: a.idx, offset,
        answer: STACK[idxB],
        key: `dist:${a.idx}:${offset}`,
      };
      showDistCardJump(a.idx, offset);
    }

    state.startedAt = performance.now();
    els.answerInput.value = '';
    resetCardKeypad();
    resetNumKeypad();
    els.feedback.classList.add('hidden');
    els.btnNext.classList.remove('pulse');
    els.timerValue.textContent = '0.0s';
    answerLocked = false;
  }

  function nextRelationPrompt(mode) {
    let pool = getFilteredPool();
    if (!pool.length) pool = STACK.map((card, idx) => ({ card, idx, pos: idx + 1 }));
    const item = pool[Math.floor(Math.random() * pool.length)];
    let targetIdx = item.idx;
    let label = 'Card Relation';
    let answerLabel = 'Select the target card';
    let key = `rel:${mode}:${item.idx}`;

    if (mode === 'next-card') {
      targetIdx = (item.idx + 1) % 52;
      label = 'Next Card';
      answerLabel = 'What card comes immediately after this?';
    } else if (mode === 'prev-card') {
      targetIdx = (item.idx + 51) % 52;
      label = 'Previous Card';
      answerLabel = 'What card comes immediately before this?';
    } else {
      const offset = Math.random() < 0.5 ? -QUARTER_DECK_OFFSET : QUARTER_DECK_OFFSET;
      targetIdx = (item.idx + offset + 52) % 52;
      const sign = offset > 0 ? `+${QUARTER_DECK_OFFSET}` : `-${QUARTER_DECK_OFFSET}`;
      label = 'Quarter-Deck Jump';
      answerLabel = `What card is ${sign} from this card?`;
      key = `rel:${mode}:${item.idx}:${offset}`;
    }

    state.currentPrompt = {
      direction: 'card-to-card',
      ask: item.card,
      answer: STACK[targetIdx],
      key,
    };

    showQuestionAsCardCue(item.card, label, answerLabel);
    state.startedAt = performance.now();
    els.answerInput.value = '';
    resetCardKeypad();
    resetNumKeypad();
    els.feedback.classList.add('hidden');
    els.btnNext.classList.remove('pulse');
    els.timerValue.textContent = '0.0s';
    answerLocked = false;
  }

  function updateQuizSettingsSummary() {
    const m = {
      mixed: 'Mixed',
      'number-to-card': 'Pos→Card',
      'card-to-number': 'Card→Pos',
      distance: 'Distance',
      'next-card': 'Next Card',
      'prev-card': 'Prev Card',
      'jump-13': '±13 Jump',
    };
    const parts = [m[quizFilters.mode] || 'Mixed'];
    if (quizFilters.color !== 'all')  parts.push(quizFilters.color === 'red' ? 'Red' : 'Black');
    if (quizFilters.suit  !== 'all')  parts.push(SUIT_SYMBOL[quizFilters.suit]);
    if (quizFilters.parity !== 'all') parts.push(quizFilters.parity === 'odd' ? 'Odd' : 'Even');
    if (quizFilters.posMin !== 1 || quizFilters.posMax !== 52) parts.push(`#${quizFilters.posMin}–${quizFilters.posMax}`);
    els.quizSettingsSummary.textContent = parts.join(' · ');
  }

  function syncChips(qs, val) {
    document.querySelectorAll(`[data-qs="${qs}"]`).forEach(c => {
      c.classList.toggle('active', c.dataset.val === val);
    });
  }

  function openQuizSetup() {
    updateQuizSettingsSummary();
    syncChips('mode',   quizFilters.mode);
    syncChips('color',  quizFilters.color);
    syncChips('suit',   quizFilters.suit);
    syncChips('parity', quizFilters.parity);
    els.qsPosMin.value = quizFilters.posMin;
    els.qsPosMax.value = quizFilters.posMax;
    els.qsRangeDisplay.textContent = `${quizFilters.posMin} – ${quizFilters.posMax}`;
    els.qsTimed.checked = quizFilters.timed;
    setView('quiz-setup');
  }

  function nextPrompt() {
    answerLocked = false;
    clearTimeout(numAutoSubmitTimer);

    if (state.mode === 'quiz') {
      if (quizFilters.mode === 'distance') { nextDistancePrompt(); return; }
      if (quizFilters.mode === 'next-card' || quizFilters.mode === 'prev-card' || quizFilters.mode === 'jump-13') {
        nextRelationPrompt(quizFilters.mode);
        return;
      }
      state.currentPrompt = weightedRandomPromptFiltered(quizFilters.mode);
    } else {
      let direction = state.mode;
      if (direction === 'mixed') direction = Math.random() < 0.5 ? 'number-to-card' : 'card-to-number';
      state.currentPrompt = weightedRandomPrompt(direction);
    }

    state.startedAt = performance.now();

    if (state.currentPrompt.direction === 'number-to-card') showQuestionAsNumber(state.currentPrompt.ask);
    else                                                      showQuestionAsCard(state.currentPrompt.ask);

    els.answerInput.value = '';
    resetCardKeypad();
    resetNumKeypad();
    els.feedback.classList.add('hidden');
    els.btnNext.classList.remove('pulse');
    els.timerValue.textContent = '0.0s';
  }

  /* ── Drill evaluation ────────────────────────────────────────── */
  function evaluate(answerRaw) {
    const prompt = state.currentPrompt;
    if (!prompt || answerLocked) return;
    answerLocked = true;

    const elapsedMs       = performance.now() - state.startedAt;
    const isNumericAnswer = /^\d+$/.test(prompt.answer);
    const expected        = isNumericAnswer ? prompt.answer : normalizeCard(prompt.answer);
    const actual          = isNumericAnswer ? answerRaw.trim() : normalizeCard(answerRaw);
    const correct         = actual === expected;

    state.sessionTotal   += 1;
    state.stats.attempts += 1;
    state.stats.totalMs  += elapsedMs;

    if (correct) {
      state.sessionCorrect += 1;
      state.stats.correct  += 1;
      state.currentStreak  += 1;
      state.stats.bestStreak = Math.max(state.stats.bestStreak, state.currentStreak);

      if (prompt.direction === 'distance') {
        if (prompt.distMode === 'card-gap') {
          const { rank: ra, suit: sa } = parseCard(STACK[prompt.idxA]);
          const { rank: rb, suit: sb } = parseCard(STACK[prompt.idxB]);
          els.feedback.innerHTML = `✅ Correct! &nbsp;<strong>${ra}${sa}</strong> ↔ <strong>${rb}${sb}</strong> = <strong>${prompt.answer}</strong> apart`;
        } else {
          const { rank: ra, suit: sa } = parseCard(STACK[prompt.idxA]);
          const { rank: rb, suit: sb } = parseCard(prompt.answer);
          const sign = prompt.offset > 0 ? `+${prompt.offset}` : String(prompt.offset);
          els.feedback.innerHTML = `✅ Correct! &nbsp;<strong>${ra}${sa}</strong> ${sign} → <strong>${rb}${sb}</strong>`;
        }
      } else if (prompt.direction === 'card-to-card') {
        const { rank: askRank, suit: askSuit } = parseCard(prompt.ask);
        const { rank: ansRank, suit: ansSuit } = parseCard(prompt.answer);
        els.feedback.innerHTML = `✅ Correct! &nbsp;<strong>${askRank}${askSuit}</strong> → <strong>${ansRank}${ansSuit}</strong>`;
      } else {
        let askDisplay, answerDisplay;
        if (isNumericAnswer) {
          const { rank, suit } = parseCard(prompt.ask);
          askDisplay    = `${rank}${suit}`;
          answerDisplay = `#${prompt.answer}`;
        } else {
          const { rank, suit } = parseCard(prompt.answer);
          askDisplay    = `#${prompt.ask}`;
          answerDisplay = `${rank}${suit}`;
        }
        els.feedback.innerHTML = `✅ Correct! &nbsp;<strong>${askDisplay}</strong> ↔ <strong>${answerDisplay}</strong>`;
      }
      els.feedback.className = 'feedback correct';

      if (prompt.key && (state.stats.missed[prompt.key] || 0) > 0) state.stats.missed[prompt.key] -= 1;
    } else {
      state.currentStreak = 0;
      if (prompt.key) state.stats.missed[prompt.key] = (state.stats.missed[prompt.key] || 0) + 1;

      let answerDisplay;
      if (prompt.direction === 'distance') {
        if (prompt.distMode === 'card-gap') {
          answerDisplay = `${prompt.answer} positions`;
        } else {
          const { rank, suit } = parseCard(prompt.answer);
          answerDisplay = `${rank}${suit}`;
        }
      } else if (isNumericAnswer) {
        answerDisplay = `#${prompt.answer}`;
      } else {
        const { rank, suit } = parseCard(prompt.answer);
        answerDisplay = `${rank}${suit}`;
      }

      els.feedback.innerHTML = `❌ Not this time. &nbsp;Answer: <strong>${answerDisplay}</strong>`;
      els.feedback.className = 'feedback wrong';
    }

    persistStats();
    updateTopStatsUI();
    updateMasteryBar();
    els.feedback.classList.remove('hidden');
    els.btnNext.classList.add('pulse');
  }

  /* ── Memorize — session ──────────────────────────────────────── */
  function openMemorize() {
    els.memInfoDue.textContent = String(srsDueCount());
    els.memInfoNew.textContent = String(srsNewCount());
    setMemView('picker');
    setView('memorize');
  }

  function randomSide() { return Math.random() < 0.5 ? 'card' : 'num'; }

  /* Build the task queue for one batch:
     imprint each card (4 steps) interleaved with early retests
     (first retest fires after the 2nd card is introduced).        */
  function buildBatchQueue(batchCards) {
    const tasks = [];
    const retestPending = [];
    const hidePatternSequence = memSettings.altHide ? IMPRINT_PATTERN_ALTERNATING : IMPRINT_PATTERN_BALANCED;

    for (let i = 0; i < batchCards.length; i++) {
      const idx = batchCards[i];
      for (let stepIndex = 0; stepIndex < hidePatternSequence.length; stepIndex++) {
        const hidePattern = hidePatternSequence[stepIndex];
        tasks.push({ type: 'imprint', idx, hidePattern, stepIndex, totalSteps: hidePatternSequence.length });
      }
      if (memSettings.earlyRetest) retestPending.push(idx);
      if (memSettings.earlyRetest && i >= 1 && retestPending.length > 0) {
        tasks.push({ type: 'retest', idx: retestPending.shift(), side: randomSide() });
      }
    }
    while (memSettings.earlyRetest && retestPending.length) {
      tasks.push({ type: 'retest', idx: retestPending.shift(), side: randomSide() });
    }
    return tasks;
  }

  function startMemSession() {
    memSess.srs       = loadSRS();
    memSess.batchSize = Number(els.memChunkSize.value) || 5;
    memSess.goodCount = 0;

    // Build a globally-shuffled deck order when randomize is checked
    if (memSettings.randomizeOrder) {
      const allNew = STACK.map((_, i) => i).filter(i => !memSess.srs[i]);
      shuffleInPlace(allNew);
      memSess.deckOrder = allNew;
    } else {
      memSess.deckOrder = null;
    }

    if (!tryStartNextBatch()) {
      renderMemComplete(true);
      setMemView('complete');
    }
  }

  /* Pick the next batch of cards from the SRS queue and start it.
     Returns false when there's nothing left to learn.            */
  function tryStartNextBatch() {
    memSess.srs = loadSRS();
    const nextCards = buildSessionQueue(memSess.srs, memSess.batchSize, memSettings.randomizeOrder, memSess.deckOrder);
    if (!nextCards.length) return false;

    memSess.currentBatchCards = nextCards;
    memSess.isRepeatBatch     = false;
    setMemView('session');
    startCurrentBatch();
    return true;
  }

  function startCurrentBatch() {
    memSess.taskQueue        = buildBatchQueue(memSess.currentBatchCards);
    memSess.inBatchRetest    = false;
    memSess.batchRetestPassed = new Set();
    updateMemProgress();
    advanceTask();
  }

  function startBatchRetestPhase() {
    memSess.inBatchRetest     = true;
    memSess.batchRetestPassed = new Set();
    memSess.batchSrsCredited  = new Set();
    const batchTasks = memSettings.bothDirections
      ? memSess.currentBatchCards.flatMap(idx => ([
        { type: 'batch-retest', idx, side: 'card' },
        { type: 'batch-retest', idx, side: 'num' },
      ]))
      : memSess.currentBatchCards.map(idx => ({ type: 'batch-retest', idx, side: randomSide() }));
    memSess.taskQueue = shuffleInPlace(batchTasks);
    advanceTask();
  }

  function advanceTask() {
    if (!memSess.taskQueue.length) {
      if (!memSess.inBatchRetest) { startBatchRetestPhase(); }
      return;
    }
    memSess.currentTask = memSess.taskQueue.shift();
    showTask(memSess.currentTask);
  }

  function setTileHidden(side, hidden) {
    (side === 'num' ? els.memTileNum : els.memTileCard)
      .classList.toggle('is-hidden', hidden);
  }

  function updateStepDots(stepIndex) {
    els.memStepDots.querySelectorAll('.mem-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === stepIndex);
      dot.classList.toggle('done',   i < stepIndex);
    });
  }

  function showTask(task) {
    const code = STACK[task.idx];
    const { rank, suit, isRed } = parseCard(code);
    const cardColor = isRed ? '#e0182d' : '#1a1a2e';

    els.memTileNumText.textContent = String(task.idx + 1);
    els.pcMainRank.textContent     = rank;
    els.pcMainSuit.textContent     = suit;
    els.pcMainRank.style.color     = cardColor;
    els.pcMainSuit.style.color     = cardColor;

    // Reset hidden state
    setTileHidden('num',  false);
    setTileHidden('card', false);

    const phaseLabel = memSess.inBatchRetest ? 'Batch Quiz' :
                       (task.type === 'retest' ? 'Recall' : 'Imprint');
    els.memPhaseLabel.textContent = phaseLabel;

    if (task.type === 'imprint') {
      setTileHidden('num',  task.hidePattern === HIDE_PATTERN_NUM);
      setTileHidden('card', task.hidePattern === HIDE_PATTERN_CARD || task.hidePattern === HIDE_PATTERN_CARD_AGAIN);
      updateStepDots(task.stepIndex);
      els.memStepDots.classList.remove('hidden');

      const finalStep = task.stepIndex >= (task.totalSteps - 1);
      els.memBtnAdvance.textContent = finalStep ? 'Done ✓' : 'Next →';
      els.memBtnAdvance.classList.remove('hidden');
      els.memBtnRevealRetest.classList.add('hidden');
      els.memRetestBtns.classList.add('hidden');
    } else {
      // Retest / batch-retest
      setTileHidden(task.side, true);
      els.memStepDots.classList.add('hidden');
      els.memBtnAdvance.classList.add('hidden');
      els.memBtnRevealRetest.classList.remove('hidden');
      els.memRetestBtns.classList.add('hidden');
    }

    // Entrance animation
    els.memPair.classList.remove('card-enter');
    void els.memPair.offsetWidth;
    els.memPair.classList.add('card-enter');
  }

  function handleMemReveal() {
    setTileHidden('num',  false);
    setTileHidden('card', false);
    els.memBtnRevealRetest.classList.add('hidden');
    els.memRetestBtns.classList.remove('hidden');
  }

  function handleMemGotIt() {
    const task = memSess.currentTask;
    if (!task) return;

    if (task.type === 'batch-retest') {
      const passKey = memSettings.bothDirections ? `${task.idx}:${task.side}` : String(task.idx);
      memSess.batchRetestPassed.add(passKey);
      if (!memSess.isRepeatBatch) {
        const creditKey = String(task.idx);
        if (!memSess.batchSrsCredited.has(creditKey)) {
          srsGotIt(memSess.srs, task.idx);
          saveSRS(memSess.srs);
          memSess.goodCount++;
          memSess.batchSrsCredited.add(creditKey);
          updateMasteryBar();
          updateMemModeBadge();
        }
      }
      updateMemProgress();
      const target = memSettings.bothDirections ? memSess.currentBatchCards.length * 2 : memSess.currentBatchCards.length;
      if (memSess.batchRetestPassed.size === target) {
        showBatchComplete();
        return;
      }
    }
    // For early retest: just advance (SRS updated during batch retest phase)
    advanceTask();
  }

  function handleMemMiss() {
    const task = memSess.currentTask;
    if (!task) return;
    // Re-imprint then re-queue the same retest type
    const hidePatternSequence = memSettings.altHide ? IMPRINT_PATTERN_ALTERNATING : IMPRINT_PATTERN_BALANCED;
    const reimprint = hidePatternSequence.map((hidePattern, stepIndex) => ({
      type: 'imprint',
      idx: task.idx,
      hidePattern,
      stepIndex,
      totalSteps: hidePatternSequence.length,
    }));
    const side = (task.type === 'batch-retest' && memSettings.bothDirections) ? task.side : randomSide();
    const retest = { type: task.type, idx: task.idx, side };
    memSess.taskQueue.unshift(...reimprint, retest);
    advanceTask();
  }

  function showBatchComplete() {
    const n = memSess.currentBatchCards.length;
    els.memBatchCompleteSub.textContent = `All ${n} pair${n !== 1 ? 's' : ''} locked in`;
    setMemView('batch-complete');
  }

  function updateMemProgress() {
    const total = memSettings.bothDirections ? memSess.currentBatchCards.length * 2 : memSess.currentBatchCards.length;
    const done  = memSess.batchRetestPassed.size;
    const pct   = total > 0 ? (done / total) * 100 : 0;
    els.memProgressFill.style.width = `${Math.min(pct, 100)}%`;
    els.memCountDone.textContent    = String(done);
    els.memCountTotal.textContent   = String(total);
  }

  function renderMemComplete(noCards) {
    const srs      = loadSRS();
    const learned  = srsGraduatedCount();
    const mastered = STACK.filter((_, i) => srs[i] && srs[i].interval >= 14).length;

    if (noCards) {
      els.memCompleteTrophy.textContent = '🌟';
      els.memCompleteSub.textContent    = "Nothing due — you're all caught up!";
    } else {
      const total = memSess.goodCount;
      els.memCompleteTrophy.textContent = '🏆';
      els.memCompleteSub.textContent    = `You locked in ${total} card${total !== 1 ? 's' : ''}`;
    }

    els.memCompleteStats.innerHTML = `
      <div class="mem-stat">
        <div class="mem-stat-n" style="color:var(--mint)">${memSess.goodCount}</div>
        <div class="mem-stat-l">Got it ✅</div>
      </div>
      <div class="mem-stat mem-stat-wide">
        <div class="mem-stat-n">${learned}<span style="font-size:1.3rem;font-weight:600;opacity:.55"> / 52</span></div>
        <div class="mem-stat-l">Cards in rotation 🔄</div>
      </div>
      <div class="mem-stat mem-stat-wide">
        <div class="mem-stat-n">${mastered}<span style="font-size:1.3rem;font-weight:600;opacity:.55"> / 52</span></div>
        <div class="mem-stat-l">Long-term mastered 🌟</div>
      </div>
    `;
  }

  /* ── Stats view ──────────────────────────────────────────────── */
  function renderStats() {
    const attempts = state.stats.attempts;
    const accuracy = attempts ? Math.round((state.stats.correct / attempts) * 100) : 0;
    const avg      = attempts ? state.stats.totalMs / attempts / 1000 : 0;
    const due      = srsDueCount();

    els.statAttempts.textContent   = String(attempts);
    els.statAccuracy.textContent   = `${accuracy}%`;
    els.statSpeed.textContent      = `${avg.toFixed(1)}s`;
    els.statBestStreak.textContent = String(state.stats.bestStreak);
    if (els.statDue) els.statDue.textContent = String(due);

    const weakPairs = Object.entries(state.stats.missed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    els.weakList.innerHTML = '';
    if (!weakPairs.length) {
      const li = document.createElement('li');
      li.textContent = 'No weak spots yet — keep drilling!';
      els.weakList.appendChild(li);
      return;
    }

    weakPairs.forEach(([key, misses]) => {
      const [num, card] = key.split(':');
      const { rank, suit } = parseCard(card);
      const li = document.createElement('li');
      li.textContent = `#${num} ↔ ${rank}${suit}  ·  missed ${misses}×`;
      els.weakList.appendChild(li);
    });
  }

  /* ── Keypad helpers ──────────────────────────────────────────── */
  function resetCardKeypad() {
    cardSel.rank = null;
    cardSel.suit = null;
    els.dispRank.textContent = '?';
    els.dispRank.className   = 'disp-rank';
    els.dispSuit.textContent = '?';
    els.dispSuit.className   = 'disp-suit';
    document.querySelectorAll('.rank-btn.selected, .suit-btn.selected')
      .forEach(b => b.classList.remove('selected'));
    els.answerInput.value = '';
  }

  function resetNumKeypad() {
    numVal = '';
    els.numDisplay.textContent = '–';
    els.answerInput.value      = '';
  }

  /* ── Event wiring ────────────────────────────────────────────── */
  function setupEvents() {
    // Mode grid
    document.querySelectorAll('.mode-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        state.mode = mode;

        if (mode === 'memorize') { openMemorize(); return; }
        if (mode === 'stats')    { renderStats(); setView('stats'); return; }
        if (mode === 'quiz')     { openQuizSetup(); return; }

        state.sessionCorrect = 0;
        state.sessionTotal   = 0;
        state.currentStreak  = 0;
        updateTopStatsUI();

        setView('trainer');
        nextPrompt();
      });
    });

    // Back buttons
    [els.btnBack, els.btnBackStats].forEach((btn) => {
      btn.addEventListener('click', () => {
        state.startedAt = 0;
        if (btn === els.btnBack && state.mode === 'quiz') openQuizSetup();
        else setView('modes');
      });
    });

    els.btnBackQuizSetup.addEventListener('click', () => setView('modes'));
    els.btnStartQuiz.addEventListener('click', () => {
      state.mode = 'quiz';
      state.sessionCorrect = 0;
      state.sessionTotal   = 0;
      state.currentStreak  = 0;
      updateTopStatsUI();
      els.questionTimer.classList.toggle('hidden', !quizFilters.timed);
      setView('trainer');
      nextPrompt();
    });

    // Memorize — picker back
    els.btnBackMemorize.addEventListener('click', () => setView('modes'));

    // Memorize — start session
    els.memBtnStart.addEventListener('click', startMemSession);

    // Memorize — session back
    els.btnBackSession.addEventListener('click', () => {
      els.memInfoDue.textContent = String(srsDueCount());
      els.memInfoNew.textContent = String(srsNewCount());
      setMemView('picker');
    });

    // Memorize — imprint advance
    els.memBtnAdvance.addEventListener('click', advanceTask);

    // Memorize — reveal (retest mode)
    els.memBtnRevealRetest.addEventListener('click', handleMemReveal);

    // Memorize — retest outcome
    els.memBtnGotIt.addEventListener('click', handleMemGotIt);
    els.memBtnMiss.addEventListener('click',  handleMemMiss);

    // Memorize — batch complete actions
    els.memBtnRepeatBatch.addEventListener('click', () => {
      memSess.isRepeatBatch = true;
      setMemView('session');
      startBatchRetestPhase();
    });
    els.memBtnNextBatch.addEventListener('click', () => {
      if (!tryStartNextBatch()) {
        renderMemComplete(false);
        setMemView('complete');
      }
    });
    els.btnBackBatchComplete.addEventListener('click', () => {
      els.memInfoDue.textContent = String(srsDueCount());
      els.memInfoNew.textContent = String(srsNewCount());
      setMemView('picker');
    });
    els.memChunkSize.addEventListener('input', () => { els.memChunkSizeValue.textContent = els.memChunkSize.value; });
    els.memRandomizeOrder.addEventListener('change', () => {
      memSettings.randomizeOrder = els.memRandomizeOrder.checked;
      saveMemSettings();
    });
    els.memAltHide.addEventListener('change', () => {
      memSettings.altHide = els.memAltHide.checked;
      saveMemSettings();
    });
    els.memEarlyRetest.addEventListener('change', () => {
      memSettings.earlyRetest = els.memEarlyRetest.checked;
      saveMemSettings();
    });
    els.memBothDirections.addEventListener('change', () => {
      memSettings.bothDirections = els.memBothDirections.checked;
      saveMemSettings();
    });
    els.memRandomizeOrder.checked = !!memSettings.randomizeOrder;
    els.memAltHide.checked = !!memSettings.altHide;
    els.memEarlyRetest.checked = !!memSettings.earlyRetest;
    els.memBothDirections.checked = !!memSettings.bothDirections;

    // Keyboard shortcuts for memorize session
    document.addEventListener('keydown', (e) => {
      if (els.memSession.classList.contains('hidden')) return;
      const retestVisible = !els.memRetestBtns.classList.contains('hidden');
      if (!retestVisible && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        if (!els.memBtnRevealRetest.classList.contains('hidden')) handleMemReveal();
        else if (!els.memBtnAdvance.classList.contains('hidden')) advanceTask();
      }
      if (retestVisible) {
        if (e.key.toLowerCase() === 'g') { e.preventDefault(); handleMemGotIt(); }
        if (e.key.toLowerCase() === 'm') { e.preventDefault(); handleMemMiss(); }
      }
    });

    // Memorize — complete screen back
    els.btnBackMemComplete.addEventListener('click', () => setView('modes'));

    // Memorize — study more
    els.memBtnStudyMore.addEventListener('click', () => {
      els.memInfoDue.textContent = String(srsDueCount());
      els.memInfoNew.textContent = String(srsNewCount());
      setMemView('picker');
    });

    // Drill — answer form (keep for keyboard Enter fallback)
    els.answerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = els.answerInput.value.trim();
      if (!val || answerLocked) return;
      evaluate(val);
    });

    // ── Card keypad (auto-submit when both rank + suit selected) ──
    function tryCardAutoSubmit() {
      if (cardSel.rank && cardSel.suit) {
        els.answerInput.value = cardSel.rank + cardSel.suit;
        // Brief 120ms delay lets the user see the suit selection highlight before submit
        setTimeout(() => evaluate(els.answerInput.value), 120);
      }
    }

    document.querySelectorAll('.rank-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answerLocked) return;
        cardSel.rank = btn.dataset.rank;
        document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const display = btn.dataset.rank === 'T' ? '10' : btn.dataset.rank;
        els.dispRank.textContent = display;
        els.dispRank.className   = 'disp-rank active';
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
        tryCardAutoSubmit();
      });
    });

    document.querySelectorAll('.suit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answerLocked) return;
        cardSel.suit = btn.dataset.suit;
        document.querySelectorAll('.suit-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const sym   = SUIT_SYMBOL[btn.dataset.suit];
        const isRed = RED_SUITS.has(btn.dataset.suit);
        els.dispSuit.textContent = sym;
        els.dispSuit.className   = `disp-suit ${isRed ? 'is-red' : 'is-black'}`;
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
        tryCardAutoSubmit();
      });
    });

    els.cardClear.addEventListener('click', () => { if (!answerLocked) resetCardKeypad(); });

    // ── Number keypad (length-aware auto-submit for reliable grading) ──
    function tryNumAutoSubmit() {
      clearTimeout(numAutoSubmitTimer);
      if (!numVal || answerLocked) return;
      if (numVal.length >= 2) {
        evaluate(numVal);
        return;
      }
      const prompt = state.currentPrompt;
      const expectedLen = (prompt && /^\d+$/.test(prompt.answer)) ? String(prompt.answer).length : null;
      if (expectedLen === 1) {
        evaluate(numVal);
      } else if (expectedLen === 2) {
        // Give a longer window for second-digit entry before grading.
        numAutoSubmitTimer = setTimeout(() => {
          if (numVal && !answerLocked) evaluate(numVal);
        }, TWO_DIGIT_AUTO_SUBMIT_DELAY_MS);
      } else {
        numAutoSubmitTimer = setTimeout(() => {
          if (numVal && !answerLocked) evaluate(numVal);
        }, AUTO_SUBMIT_DELAY_MS);
      }
    }

    document.querySelectorAll('.num-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answerLocked) return;
        if (numVal.length >= 2) return;
        if (numVal === '' && btn.dataset.num === '0') return;
        numVal += btn.dataset.num;
        els.numDisplay.textContent = numVal;
        els.answerInput.value      = numVal;
        tryNumAutoSubmit();
      });
    });

    els.numBack.addEventListener('click', () => {
      if (answerLocked) return;
      clearTimeout(numAutoSubmitTimer);
      numVal = numVal.slice(0, -1);
      els.numDisplay.textContent = numVal || '–';
      els.answerInput.value      = numVal;
    });

    els.numClear.addEventListener('click', () => {
      if (!answerLocked) { clearTimeout(numAutoSubmitTimer); resetNumKeypad(); }
    });

    // ── Quiz settings panel ───────────────────────────────────────
    document.querySelectorAll('[data-qs]').forEach(chip => {
      chip.addEventListener('click', () => {
        const qs  = chip.dataset.qs;
        const val = chip.dataset.val;
        quizFilters[qs] = val;
        saveQuizFilters();
        syncChips(qs, val);
        updateQuizSettingsSummary();
        // If timer toggled via chip, update header
        if (qs === 'timed') els.questionTimer.classList.toggle('hidden', val !== 'true');
      });
    });

    els.qsTimed.addEventListener('change', () => {
      quizFilters.timed = els.qsTimed.checked;
      saveQuizFilters();
      els.questionTimer.classList.toggle('hidden', !quizFilters.timed);
      updateQuizSettingsSummary();
    });

    function updateRangeDisplay() {
      let min = parseInt(els.qsPosMin.value, 10);
      let max = parseInt(els.qsPosMax.value, 10);
      if (min > max) { [min, max] = [max, min]; }
      quizFilters.posMin = min;
      quizFilters.posMax = max;
      els.qsRangeDisplay.textContent = `${min} – ${max}`;
      saveQuizFilters();
      updateQuizSettingsSummary();
    }
    els.qsPosMin.addEventListener('input', updateRangeDisplay);
    els.qsPosMax.addEventListener('input', updateRangeDisplay);

    // Reveal
    els.btnReveal.addEventListener('click', () => {
      if (!state.currentPrompt || answerLocked) return;
      answerLocked = true;
      clearTimeout(numAutoSubmitTimer);
      const prompt          = state.currentPrompt;
      const isNumericAnswer = /^\d+$/.test(prompt.answer);
      let display;
      if (prompt.direction === 'distance') {
        if (prompt.distMode === 'card-gap') {
          display = `${prompt.answer} positions apart`;
        } else {
          const { rank, suit } = parseCard(prompt.answer);
          display = `${rank}${suit}`;
        }
      } else if (isNumericAnswer) {
        display = `#${prompt.answer}`;
      } else {
        const { rank, suit } = parseCard(prompt.answer);
        display = `${rank}${suit}`;
      }
      els.feedback.innerHTML = `💡 Answer: <strong>${display}</strong>`;
      els.feedback.className = 'feedback reveal';
      els.feedback.classList.remove('hidden');
      els.btnNext.classList.add('pulse');
    });

    els.btnNext.addEventListener('click', nextPrompt);

    // Reset all stats + SRS data
    els.btnReset.addEventListener('click', () => {
      state.stats = { attempts: 0, correct: 0, totalMs: 0, bestStreak: 0, missed: {} };
      persistStats();
      localStorage.removeItem(SRS_KEY);
      renderStats();
      updateMasteryBar();
      updateMemModeBadge();
    });

    // Keyboard shortcuts for drill
    document.addEventListener('keydown', (e) => {
      if (els.trainer.classList.contains('hidden')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = els.answerInput.value.trim();
        if (val) evaluate(val);
      }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); nextPrompt(); }
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); els.btnReveal.click(); }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  /* ── Boot ────────────────────────────────────────────────────── */
  setupEvents();
  updateTopStatsUI();
  updateMasteryBar();
  updateMemModeBadge();
  setView('modes');
  registerServiceWorker();

  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
