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
  const SESSION_SIZE         = 10;
  const MAX_DUE_PER_SESSION  = 7;
  const MAX_REQUEUES         = 3;

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

  function srsPrevInterval(cur) {
    if (!cur || cur <= 1) return 0;
    const i = SRS_INTERVALS.indexOf(cur);
    return i <= 0 ? 0 : SRS_INTERVALS[i - 1];
  }

  function srsGotIt(srs, idx) {
    const cur         = srs[idx];
    const newInterval = srsNextInterval(cur ? cur.interval : 0);
    srs[idx] = { interval: newInterval, due: Date.now() + newInterval * MS_PER_DAY };
  }

  function srsAgain(srs, idx) {
    const cur         = srs[idx];
    const newInterval = srsPrevInterval(cur ? cur.interval : 0);
    srs[idx] = {
      interval: newInterval,
      due: newInterval > 0 ? Date.now() + newInterval * MS_PER_DAY : Date.now(),
    };
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

  function buildSessionQueue(srs) {
    const now = Date.now();

    const due = STACK
      .map((_, i) => ({ idx: i, due: srs[i] ? srs[i].due : Infinity }))
      .filter(c => srs[c.idx] && c.due <= now)
      .sort((a, b) => a.due - b.due)
      .slice(0, MAX_DUE_PER_SESSION)
      .map(c => c.idx);

    const remaining = SESSION_SIZE - due.length;
    const newCards  = STACK
      .map((_, i) => i)
      .filter(i => !srs[i])
      .slice(0, remaining);

    // Interleave due and new cards for a natural feel
    const combined = [];
    const len = Math.max(due.length, newCards.length);
    for (let i = 0; i < len; i++) {
      if (i < due.length)      combined.push(due[i]);
      if (i < newCards.length) combined.push(newCards[i]);
    }
    return combined;
  }

  /* ── Memorize session state ──────────────────────────────────── */
  const memSess = {
    queue:        [],
    initialCount: 0,
    goodCount:    0,
    againCount:   0,
    currentIdx:   null,
    flipped:      false,
    srs:          null,
    agained:      {},   // idx → times re-queued this session (caps at 3)
  };

  /* ── DOM references ──────────────────────────────────────────── */
  const els = {
    modeGrid:           document.getElementById('modeGrid'),
    trainer:            document.getElementById('trainer'),
    memorize:           document.getElementById('memorize'),
    stats:              document.getElementById('stats'),
    streakChip:         document.getElementById('streakChip'),
    masteryFill:        document.getElementById('masteryFill'),
    masteryText:        document.getElementById('masteryText'),
    btnBack:            document.getElementById('btnBack'),
    btnBackStats:       document.getElementById('btnBackStats'),
    scoreline:          document.getElementById('scoreline'),
    questionLabel:      document.getElementById('questionLabel'),
    questionPrefix:     document.getElementById('questionPrefix'),
    questionValue:      document.getElementById('questionValue'),
    questionSuit:       document.getElementById('questionSuit'),
    timerValue:         document.getElementById('timerValue'),
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
    // Memorize
    memModeBadge:       document.getElementById('memModeBadge'),
    memPicker:          document.getElementById('memPicker'),
    memSession:         document.getElementById('memSession'),
    memComplete:        document.getElementById('memComplete'),
    btnBackMemorize:    document.getElementById('btnBackMemorize'),
    memInfoDue:         document.getElementById('memInfoDue'),
    memInfoNew:         document.getElementById('memInfoNew'),
    memBtnStart:        document.getElementById('memBtnStart'),
    memScene:           document.getElementById('memScene'),
    memCard:            document.getElementById('memCard'),
    memFaceNumber:      document.getElementById('memFaceNumber'),
    pcRank1:            document.getElementById('pcRank1'),
    pcSuit1:            document.getElementById('pcSuit1'),
    pcPip:              document.getElementById('pcPip'),
    pcRank2:            document.getElementById('pcRank2'),
    pcSuit2:            document.getElementById('pcSuit2'),
    memTapPrompt:       document.getElementById('memTapPrompt'),
    memRating:          document.getElementById('memRating'),
    memBtnAgain:        document.getElementById('memBtnAgain'),
    memBtnGood:         document.getElementById('memBtnGood'),
    memProgressFill:    document.getElementById('memProgressFill'),
    memCountDone:       document.getElementById('memCountDone'),
    memCountTotal:      document.getElementById('memCountTotal'),
    btnBackSession:     document.getElementById('btnBackSession'),
    memCompleteTrophy:  document.getElementById('memCompleteTrophy'),
    memCompleteSub:     document.getElementById('memCompleteSub'),
    memCompleteStats:   document.getElementById('memCompleteStats'),
    memBtnStudyMore:    document.getElementById('memBtnStudyMore'),
    btnBackMemComplete: document.getElementById('btnBackMemComplete'),
  };

  // Keypad selection state
  const cardSel = { rank: null, suit: null };
  let numVal = '';

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

  function updateMasteryBar() {
    const count = srsGraduatedCount();
    const pct   = Math.round((count / STACK.length) * 100);
    els.masteryFill.style.width = `${pct}%`;
    els.masteryText.textContent = `${count} / ${STACK.length}`;
  }

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
    els.trainer.classList.toggle('hidden',    name !== 'trainer');
    els.memorize.classList.toggle('hidden',   name !== 'memorize');
    els.stats.classList.toggle('hidden',      name !== 'stats');
  }

  function setMemView(name) {
    els.memPicker.classList.toggle('hidden',   name !== 'picker');
    els.memSession.classList.toggle('hidden',  name !== 'session');
    els.memComplete.classList.toggle('hidden', name !== 'complete');
  }

  /* ── Drill prompt logic ──────────────────────────────────────── */
  function showQuestionAsNumber(num) {
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

  function nextPrompt() {
    let direction = state.mode;
    if (direction === 'mixed') direction = Math.random() < 0.5 ? 'number-to-card' : 'card-to-number';

    state.currentPrompt = weightedRandomPrompt(direction);
    state.startedAt     = performance.now();

    if (direction === 'number-to-card') showQuestionAsNumber(state.currentPrompt.ask);
    else                                 showQuestionAsCard(state.currentPrompt.ask);

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
    if (!prompt) return;

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
      els.feedback.className = 'feedback correct';

      if ((state.stats.missed[prompt.key] || 0) > 0) state.stats.missed[prompt.key] -= 1;
    } else {
      state.currentStreak = 0;
      state.stats.missed[prompt.key] = (state.stats.missed[prompt.key] || 0) + 1;

      let answerDisplay;
      if (isNumericAnswer) {
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

  function startMemSession() {
    memSess.srs          = loadSRS();
    memSess.queue        = buildSessionQueue(memSess.srs);
    memSess.initialCount = memSess.queue.length;
    memSess.goodCount    = 0;
    memSess.againCount   = 0;
    memSess.flipped      = false;
    memSess.agained      = {};

    if (!memSess.queue.length) {
      renderMemComplete(true);
      setMemView('complete');
      return;
    }

    setMemView('session');
    showMemCard();
  }

  function showMemCard() {
    if (!memSess.queue.length) {
      renderMemComplete(false);
      setMemView('complete');
      return;
    }

    memSess.currentIdx = memSess.queue.shift();
    memSess.flipped    = false;

    const code = STACK[memSess.currentIdx];
    const { rank, suit, isRed } = parseCard(code);
    const cardColor = isRed ? '#e0182d' : '#1a1a2e';
    const suitSym   = SUIT_SYMBOL[code[1]];

    // Front face
    els.memFaceNumber.textContent = String(memSess.currentIdx + 1);

    // Back face (playing card)
    [els.pcRank1, els.pcRank2].forEach(el => {
      el.textContent = rank;
      el.style.color = cardColor;
    });
    [els.pcSuit1, els.pcSuit2].forEach(el => {
      el.textContent = suitSym;
      el.style.color = cardColor;
    });
    els.pcPip.textContent = suitSym;
    els.pcPip.style.color = cardColor;

    // Animate card in
    els.memCard.classList.remove('flipped', 'card-enter');
    void els.memCard.offsetWidth;
    els.memCard.classList.add('card-enter');

    // Reset UI state
    els.memRating.classList.add('hidden');
    els.memTapPrompt.classList.remove('hidden');

    updateMemProgress();
  }

  function flipMemCard() {
    if (memSess.flipped) return;
    memSess.flipped = true;
    els.memCard.classList.add('flipped');
    setTimeout(() => {
      els.memTapPrompt.classList.add('hidden');
      els.memRating.classList.remove('hidden');
    }, 320);
  }

  function rateGood() {
    srsGotIt(memSess.srs, memSess.currentIdx);
    saveSRS(memSess.srs);
    memSess.goodCount += 1;
    updateMasteryBar();
    updateMemModeBadge();
    showMemCard();
  }

  function rateAgain() {
    srsAgain(memSess.srs, memSess.currentIdx);
    saveSRS(memSess.srs);
    memSess.againCount += 1;
    // Re-insert near the end (max 3 re-queues per card to prevent infinite loops)
    const times = (memSess.agained[memSess.currentIdx] || 0) + 1;
    memSess.agained[memSess.currentIdx] = times;
    if (times <= MAX_REQUEUES) {
      const insertAt = Math.max(0, memSess.queue.length - 2);
      memSess.queue.splice(insertAt, 0, memSess.currentIdx);
    }
    showMemCard();
  }

  function updateMemProgress() {
    const total = memSess.initialCount;
    const done  = memSess.goodCount;
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
      const total = memSess.goodCount + memSess.againCount;
      els.memCompleteTrophy.textContent = memSess.againCount === 0 ? '🏆' : '🎊';
      els.memCompleteSub.textContent    = `You studied ${total} card${total !== 1 ? 's' : ''} this session`;
    }

    els.memCompleteStats.innerHTML = `
      <div class="mem-stat">
        <div class="mem-stat-n" style="color:var(--mint)">${memSess.goodCount}</div>
        <div class="mem-stat-l">Got it ✅</div>
      </div>
      <div class="mem-stat">
        <div class="mem-stat-n" style="color:var(--rose)">${memSess.againCount}</div>
        <div class="mem-stat-l">Again 😓</div>
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

    els.statAttempts.textContent   = String(attempts);
    els.statAccuracy.textContent   = `${accuracy}%`;
    els.statSpeed.textContent      = `${avg.toFixed(1)}s`;
    els.statBestStreak.textContent = String(state.stats.bestStreak);

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
        setView('modes');
      });
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

    // Memorize — flip card (click and keyboard)
    els.memScene.addEventListener('click', flipMemCard);
    els.memScene.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipMemCard(); }
    });

    // Memorize — rating buttons
    els.memBtnAgain.addEventListener('click', rateAgain);
    els.memBtnGood.addEventListener('click',  rateGood);

    // Keyboard shortcuts for memorize session
    document.addEventListener('keydown', (e) => {
      if (els.memSession.classList.contains('hidden')) return;
      if (e.key.toLowerCase() === 'a' && !els.memRating.classList.contains('hidden')) {
        e.preventDefault(); rateAgain();
      }
      if (e.key.toLowerCase() === 'g' && !els.memRating.classList.contains('hidden')) {
        e.preventDefault(); rateGood();
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

    // Drill — answer form
    els.answerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = els.answerInput.value.trim();
      if (!val) return;
      evaluate(val);
    });

    // Card keypad
    document.querySelectorAll('.rank-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cardSel.rank = btn.dataset.rank;
        document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const display = btn.dataset.rank === 'T' ? '10' : btn.dataset.rank;
        els.dispRank.textContent = display;
        els.dispRank.className   = 'disp-rank active';
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
      });
    });

    document.querySelectorAll('.suit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cardSel.suit = btn.dataset.suit;
        document.querySelectorAll('.suit-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const sym   = SUIT_SYMBOL[btn.dataset.suit];
        const isRed = RED_SUITS.has(btn.dataset.suit);
        els.dispSuit.textContent = sym;
        els.dispSuit.className   = `disp-suit ${isRed ? 'is-red' : 'is-black'}`;
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
      });
    });

    els.cardClear.addEventListener('click', resetCardKeypad);

    // Number keypad
    document.querySelectorAll('.num-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (numVal.length >= 2) return;
        if (numVal === '' && btn.dataset.num === '0') return;
        numVal += btn.dataset.num;
        els.numDisplay.textContent = numVal;
        els.answerInput.value      = numVal;
      });
    });

    els.numBack.addEventListener('click', () => {
      numVal = numVal.slice(0, -1);
      els.numDisplay.textContent = numVal || '–';
      els.answerInput.value      = numVal;
    });

    els.numClear.addEventListener('click', resetNumKeypad);

    // Reveal
    els.btnReveal.addEventListener('click', () => {
      if (!state.currentPrompt) return;
      const prompt          = state.currentPrompt;
      const isNumericAnswer = /^\d+$/.test(prompt.answer);
      let display;
      if (isNumericAnswer) {
        display = `#${prompt.answer}`;
      } else {
        const { rank, suit } = parseCard(prompt.answer);
        display = `${rank}${suit}`;
      }
      els.feedback.innerHTML = `💡 Answer: <strong>${display}</strong>`;
      els.feedback.className = 'feedback reveal';
      els.feedback.classList.remove('hidden');
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
