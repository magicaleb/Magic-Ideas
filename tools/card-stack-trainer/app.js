(() => {
  'use strict';

  const STACK = [
    'AH','KS','AD','KC','2H','QS','2D','QC','3H','JS','3D','JC','4H','TS','4D','TC',
    '5H','9S','5D','9C','6H','8S','6D','8C','7H','7S','7D','7C','8H','6S','8D','6C',
    '9H','5S','9D','5C','TH','4S','TD','4C','JH','3S','JD','3C','QH','2S','QD','2C',
    'KH','AS','KD','AC'
  ];

  const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const RANK_DISPLAY = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10' };
  const RED_SUITS = new Set(['H', 'D']);

  function parseCard(code) {
    const rank = RANK_DISPLAY[code[0]] ?? code[0];
    const suit = SUIT_SYMBOL[code[1]] ?? code[1];
    const isRed = RED_SUITS.has(code[1]);
    return { rank, suit, isRed };
  }

  const cardToNumber = new Map(STACK.map((card, i) => [card, i + 1]));

  const state = {
    mode: null,
    currentPrompt: null,
    startedAt: 0,
    stats: loadStats(),
    sessionCorrect: 0,
    sessionTotal: 0,
    currentStreak: 0,
  };

  const els = {
    modeGrid:       document.getElementById('modeGrid'),
    trainer:        document.getElementById('trainer'),
    review:         document.getElementById('review'),
    stats:          document.getElementById('stats'),
    streakChip:     document.getElementById('streakChip'),
    masteryFill:    document.getElementById('masteryFill'),
    masteryText:    document.getElementById('masteryText'),
    btnBack:        document.getElementById('btnBack'),
    btnBackReview:  document.getElementById('btnBackReview'),
    btnBackStats:   document.getElementById('btnBackStats'),
    scoreline:      document.getElementById('scoreline'),
    questionLabel:  document.getElementById('questionLabel'),
    questionPrefix: document.getElementById('questionPrefix'),
    questionValue:  document.getElementById('questionValue'),
    questionSuit:   document.getElementById('questionSuit'),
    timerValue:     document.getElementById('timerValue'),
    answerForm:     document.getElementById('answerForm'),
    answerInput:    document.getElementById('answerInput'),
    answerLabel:    document.getElementById('answerLabel'),
    feedback:       document.getElementById('feedback'),
    btnReveal:      document.getElementById('btnReveal'),
    btnNext:        document.getElementById('btnNext'),
    stackGrid:      document.getElementById('stackGrid'),
    statAttempts:   document.getElementById('statAttempts'),
    statAccuracy:   document.getElementById('statAccuracy'),
    statSpeed:      document.getElementById('statSpeed'),
    statBestStreak: document.getElementById('statBestStreak'),
    weakList:       document.getElementById('weakList'),
    btnReset:       document.getElementById('btnReset'),
    // Keypads
    cardKeypad:     document.getElementById('cardKeypad'),
    numKeypad:      document.getElementById('numKeypad'),
    dispRank:       document.getElementById('dispRank'),
    dispSuit:       document.getElementById('dispSuit'),
    numDisplay:     document.getElementById('numDisplay'),
    cardClear:      document.getElementById('cardClear'),
    numClear:       document.getElementById('numClear'),
    numBack:        document.getElementById('numBack'),
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

  function loadStats() {
    const defaults = { attempts: 0, correct: 0, totalMs: 0, bestStreak: 0, missed: {}, mastered: {} };
    try {
      const raw = localStorage.getItem('stackSprintStats');
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  }

  function persistStats() {
    localStorage.setItem('stackSprintStats', JSON.stringify(state.stats));
  }

  function getMasteredCount() {
    return Object.values(state.stats.mastered).filter(Boolean).length;
  }

  /* ── UI updates ─────────────────────────────────────────────── */
  function updateStreakChip() {
    els.streakChip.textContent = `${state.currentStreak} 🔥`;
    els.streakChip.classList.remove('bump');
    // Force reflow to restart animation
    void els.streakChip.offsetWidth;
    els.streakChip.classList.add('bump');
  }

  function updateMasteryBar() {
    const count = getMasteredCount();
    const pct = Math.round((count / STACK.length) * 100);
    els.masteryFill.style.width = `${pct}%`;
    els.masteryText.textContent = `${count} / ${STACK.length}`;
  }

  function updateTopStatsUI() {
    const pct = state.sessionTotal
      ? Math.round((state.sessionCorrect / state.sessionTotal) * 100)
      : 0;
    els.scoreline.textContent = `${state.sessionCorrect} / ${state.sessionTotal} • ${pct}%`;
    updateStreakChip();
  }

  function showQuestionAsNumber(num) {
    els.questionLabel.textContent = 'Position';
    els.questionPrefix.textContent = '#';
    els.questionPrefix.style.display = '';
    els.questionValue.textContent = String(num);
    els.questionValue.classList.remove('is-red');
    els.questionSuit.classList.add('hidden');
    els.answerLabel.textContent = 'Select the card at this position';
    els.cardKeypad.classList.remove('hidden');
    els.numKeypad.classList.add('hidden');
  }

  function showQuestionAsCard(code) {
    const { rank, suit, isRed } = parseCard(code);
    els.questionLabel.textContent = 'Card';
    els.questionPrefix.style.display = 'none';
    els.questionValue.textContent = rank;
    els.questionValue.classList.toggle('is-red', isRed);
    els.questionSuit.textContent = suit;
    els.questionSuit.className = `question-suit ${isRed ? 'is-red' : 'is-black'}`;
    els.answerLabel.textContent = 'Enter position  (1–52)';
    els.cardKeypad.classList.add('hidden');
    els.numKeypad.classList.remove('hidden');
  }

  function setView(name) {
    els.modeGrid.classList.toggle('hidden', name !== 'modes');
    els.trainer.classList.toggle('hidden',  name !== 'trainer');
    els.review.classList.toggle('hidden',   name !== 'review');
    els.stats.classList.toggle('hidden',    name !== 'stats');
  }

  /* ── Prompt logic ────────────────────────────────────────────── */
  function weightedRandomPrompt(direction) {
    const pool = STACK.map((card, idx) => {
      const key = `${idx + 1}:${card}`;
      const misses = state.stats.missed[key] || 0;
      const masteredPenalty = state.stats.mastered[key] ? 0.4 : 1;
      const weight = Math.max(1, misses * 1.8) * masteredPenalty;
      return { idx, card, weight };
    });

    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
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
    if (direction === 'mixed') {
      direction = Math.random() < 0.5 ? 'number-to-card' : 'card-to-number';
    }

    state.currentPrompt = weightedRandomPrompt(direction);
    state.startedAt = performance.now();

    if (direction === 'number-to-card') {
      showQuestionAsNumber(state.currentPrompt.ask);
    } else {
      showQuestionAsCard(state.currentPrompt.ask);
    }

    els.answerInput.value = '';
    resetCardKeypad();
    resetNumKeypad();
    els.feedback.classList.add('hidden');
    els.btnNext.classList.remove('pulse');
    els.timerValue.textContent = '0.0s';
  }

  /* ── Evaluation ──────────────────────────────────────────────── */
  function evaluate(answerRaw) {
    const prompt = state.currentPrompt;
    if (!prompt) return;

    const elapsedMs = performance.now() - state.startedAt;
    const isNumericAnswer = /^\d+$/.test(prompt.answer);
    const expected = isNumericAnswer ? prompt.answer : normalizeCard(prompt.answer);
    const actual   = isNumericAnswer ? answerRaw.trim() : normalizeCard(answerRaw);
    const correct  = actual === expected;

    state.sessionTotal    += 1;
    state.stats.attempts  += 1;
    state.stats.totalMs   += elapsedMs;

    if (correct) {
      state.sessionCorrect += 1;
      state.stats.correct  += 1;
      state.currentStreak  += 1;
      state.stats.bestStreak = Math.max(state.stats.bestStreak, state.currentStreak);

      let askDisplay, answerDisplay;
      if (isNumericAnswer) {
        // card-to-number: ask=card code, answer=position number
        const { rank, suit } = parseCard(prompt.ask);
        askDisplay = `${rank}${suit}`;
        answerDisplay = `#${prompt.answer}`;
      } else {
        // number-to-card: ask=position number, answer=card code
        const { rank, suit } = parseCard(prompt.answer);
        askDisplay = `#${prompt.ask}`;
        answerDisplay = `${rank}${suit}`;
      }

      els.feedback.innerHTML = `✅ Correct! &nbsp;<strong>${askDisplay}</strong> ↔ <strong>${answerDisplay}</strong>`;
      els.feedback.className = 'feedback correct';

      if ((state.stats.missed[prompt.key] || 0) > 0) {
        state.stats.missed[prompt.key] -= 1;
      }
    } else {
      state.currentStreak = 0;
      state.stats.missed[prompt.key] = (state.stats.missed[prompt.key] || 0) + 1;

      let answerDisplay;
      if (isNumericAnswer) {
        // card-to-number: correct answer is the position number
        answerDisplay = `#${prompt.answer}`;
      } else {
        // number-to-card: correct answer is the card
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

  /* ── Stack Explorer ──────────────────────────────────────────── */
  function buildExplorer() {
    els.stackGrid.innerHTML = '';
    STACK.forEach((card, idx) => {
      const n   = idx + 1;
      const key = `${n}:${card}`;
      const { rank, suit, isRed } = parseCard(card);
      const isMastered = !!state.stats.mastered[key];

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `stack-tile${isRed ? ' red-card' : ''}${isMastered ? ' mastered' : ''}`;

      tile.innerHTML = `
        <span class="face front">
          <span class="tile-pos">#${n}</span>
        </span>
        <span class="face back">
          <span class="tile-rank">${rank}</span>
          <span class="tile-suit-back">${suit}</span>
        </span>
        <span class="star" aria-label="${isMastered ? 'mastered' : 'not mastered'}">${isMastered ? '⭐' : '☆'}</span>
      `;

      tile.addEventListener('click', (e) => {
        if (e.target.classList.contains('star')) return;
        tile.classList.toggle('flipped');
      });

      tile.querySelector('.star').addEventListener('click', (e) => {
        e.stopPropagation();
        state.stats.mastered[key] = !state.stats.mastered[key];
        persistStats();
        updateMasteryBar();
        buildExplorer();
      });

      els.stackGrid.appendChild(tile);
    });
  }

  /* ── Stats view ──────────────────────────────────────────────── */
  function renderStats() {
    const attempts  = state.stats.attempts;
    const accuracy  = attempts ? Math.round((state.stats.correct / attempts) * 100) : 0;
    const avg       = attempts ? state.stats.totalMs / attempts / 1000 : 0;

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
    els.dispRank.className = 'disp-rank';
    els.dispSuit.textContent = '?';
    els.dispSuit.className = 'disp-suit';
    document.querySelectorAll('.rank-btn.selected, .suit-btn.selected').forEach(b => b.classList.remove('selected'));
    els.answerInput.value = '';
  }

  function resetNumKeypad() {
    numVal = '';
    els.numDisplay.textContent = '–';
    els.answerInput.value = '';
  }

  /* ── Event wiring ────────────────────────────────────────────── */
  function setupEvents() {
    document.querySelectorAll('.mode-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        state.mode = mode;

        if (mode === 'review') {
          buildExplorer();
          setView('review');
          return;
        }
        if (mode === 'stats') {
          renderStats();
          setView('stats');
          return;
        }

        state.sessionCorrect = 0;
        state.sessionTotal   = 0;
        state.currentStreak  = 0;
        updateTopStatsUI();
        setView('trainer');
        nextPrompt();
      });
    });

    [els.btnBack, els.btnBackReview, els.btnBackStats].forEach((btn) => {
      btn.addEventListener('click', () => {
        state.startedAt = 0;
        setView('modes');
      });
    });

    els.answerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = els.answerInput.value.trim();
      if (!val) return;
      evaluate(val);
    });

    // ── Card keypad ──
    document.querySelectorAll('.rank-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cardSel.rank = btn.dataset.rank;
        document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const display = btn.dataset.rank === 'T' ? '10' : btn.dataset.rank;
        els.dispRank.textContent = display;
        els.dispRank.className = 'disp-rank active';
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
      });
    });

    document.querySelectorAll('.suit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cardSel.suit = btn.dataset.suit;
        document.querySelectorAll('.suit-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const sym = SUIT_SYMBOL[btn.dataset.suit];
        const isRed = RED_SUITS.has(btn.dataset.suit);
        els.dispSuit.textContent = sym;
        els.dispSuit.className = `disp-suit ${isRed ? 'is-red' : 'is-black'}`;
        if (cardSel.rank && cardSel.suit) els.answerInput.value = cardSel.rank + cardSel.suit;
      });
    });

    els.cardClear.addEventListener('click', resetCardKeypad);

    // ── Number keypad ──
    document.querySelectorAll('.num-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (numVal.length >= 2) return;
        if (numVal === '' && btn.dataset.num === '0') return; // no leading zero
        numVal += btn.dataset.num;
        els.numDisplay.textContent = numVal;
        els.answerInput.value = numVal;
      });
    });

    els.numBack.addEventListener('click', () => {
      numVal = numVal.slice(0, -1);
      els.numDisplay.textContent = numVal || '–';
      els.answerInput.value = numVal;
    });

    els.numClear.addEventListener('click', resetNumKeypad);

    els.btnReveal.addEventListener('click', () => {
      if (!state.currentPrompt) return;
      const prompt = state.currentPrompt;
      const isNumericAnswer = /^\d+$/.test(prompt.answer);
      let display;
      if (isNumericAnswer) {
        const { rank, suit } = parseCard(prompt.ask);
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

    els.btnReset.addEventListener('click', () => {
      state.stats = { attempts: 0, correct: 0, totalMs: 0, bestStreak: 0, missed: {}, mastered: {} };
      persistStats();
      renderStats();
      buildExplorer();
      updateMasteryBar();
    });

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
  setView('modes');
  registerServiceWorker();

  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
