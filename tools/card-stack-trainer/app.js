(() => {
  'use strict';

  const STACK = [
    'AH','KS','AD','KC','2H','QS','2D','QC','3H','JS','3D','JC','4H','TS','4D','TC',
    '5H','9S','5D','9C','6H','8S','6D','8C','7H','7S','7D','7C','8H','6S','8D','6C',
    '9H','5S','9D','5C','TH','4S','TD','4C','JH','3S','JD','3C','QH','2S','QD','2C',
    'KH','AS','KD','AC'
  ];

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
    modeGrid: document.getElementById('modeGrid'),
    trainer: document.getElementById('trainer'),
    review: document.getElementById('review'),
    stats: document.getElementById('stats'),
    streakChip: document.getElementById('streakChip'),
    btnBack: document.getElementById('btnBack'),
    btnBackReview: document.getElementById('btnBackReview'),
    btnBackStats: document.getElementById('btnBackStats'),
    scoreline: document.getElementById('scoreline'),
    questionLabel: document.getElementById('questionLabel'),
    questionValue: document.getElementById('questionValue'),
    timerValue: document.getElementById('timerValue'),
    answerForm: document.getElementById('answerForm'),
    answerInput: document.getElementById('answerInput'),
    answerLabel: document.getElementById('answerLabel'),
    feedback: document.getElementById('feedback'),
    btnReveal: document.getElementById('btnReveal'),
    btnNext: document.getElementById('btnNext'),
    stackGrid: document.getElementById('stackGrid'),
    statAttempts: document.getElementById('statAttempts'),
    statAccuracy: document.getElementById('statAccuracy'),
    statSpeed: document.getElementById('statSpeed'),
    statBestStreak: document.getElementById('statBestStreak'),
    weakList: document.getElementById('weakList'),
    btnReset: document.getElementById('btnReset'),
  };

  const timer = setInterval(() => {
    if (!state.startedAt || els.trainer.classList.contains('hidden')) return;
    const seconds = (performance.now() - state.startedAt) / 1000;
    els.timerValue.textContent = `${seconds.toFixed(1)}s`;
  }, 80);

  function normalizeCard(value) {
    return value.trim().toUpperCase().replace('10', 'T');
  }

  function loadStats() {
    const defaults = {
      attempts: 0,
      correct: 0,
      totalMs: 0,
      bestStreak: 0,
      missed: {},
      mastered: {},
    };
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

  function updateTopStatsUI() {
    const pct = state.sessionTotal ? Math.round((state.sessionCorrect / state.sessionTotal) * 100) : 0;
    els.scoreline.textContent = `${state.sessionCorrect} / ${state.sessionTotal} • ${pct}%`;
    els.streakChip.textContent = `Streak: ${state.currentStreak} 🔥`;
  }

  function setView(name) {
    els.modeGrid.classList.toggle('hidden', name !== 'modes');
    els.trainer.classList.toggle('hidden', name !== 'trainer');
    els.review.classList.toggle('hidden', name !== 'review');
    els.stats.classList.toggle('hidden', name !== 'stats');
  }

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
          ? { ask: String(item.idx + 1), answer: item.card, key: `${item.idx + 1}:${item.card}` }
          : { ask: item.card, answer: String(item.idx + 1), key: `${item.idx + 1}:${item.card}` };
      }
    }
    return { ask: '1', answer: 'AH', key: '1:AH' };
  }

  function nextPrompt() {
    let direction = state.mode;
    if (direction === 'mixed') {
      direction = Math.random() < 0.5 ? 'number-to-card' : 'card-to-number';
    }

    state.currentPrompt = weightedRandomPrompt(direction);
    state.startedAt = performance.now();

    const isNumberAsk = direction === 'number-to-card';
    els.questionLabel.textContent = isNumberAsk ? 'Position' : 'Card';
    els.questionValue.textContent = state.currentPrompt.ask;
    els.answerLabel.textContent = isNumberAsk ? 'Enter card (e.g. 5H)' : 'Enter position (1-52)';
    els.answerInput.value = '';
    els.answerInput.inputMode = isNumberAsk ? 'text' : 'numeric';
    els.answerInput.focus();
    els.feedback.classList.add('hidden');
    els.btnNext.classList.remove('pulse');
    els.timerValue.textContent = '0.0s';
  }

  function evaluate(answerRaw) {
    const prompt = state.currentPrompt;
    if (!prompt) return;

    const elapsedMs = performance.now() - state.startedAt;
    const expected = /^\d+$/.test(prompt.answer) ? prompt.answer : normalizeCard(prompt.answer);
    const actual = /^\d+$/.test(prompt.answer) ? answerRaw.trim() : normalizeCard(answerRaw);
    const correct = actual === expected;

    state.sessionTotal += 1;
    state.stats.attempts += 1;
    state.stats.totalMs += elapsedMs;

    if (correct) {
      state.sessionCorrect += 1;
      state.stats.correct += 1;
      state.currentStreak += 1;
      state.stats.bestStreak = Math.max(state.stats.bestStreak, state.currentStreak);
      els.feedback.innerHTML = `✅ Correct. <strong>${prompt.ask}</strong> ↔ <strong>${prompt.answer}</strong>`;
      els.feedback.className = 'feedback correct';
      if ((state.stats.missed[prompt.key] || 0) > 0) {
        state.stats.missed[prompt.key] -= 1;
      }
    } else {
      state.currentStreak = 0;
      state.stats.missed[prompt.key] = (state.stats.missed[prompt.key] || 0) + 1;
      els.feedback.innerHTML = `❌ Not this time. Correct answer: <strong>${prompt.answer}</strong>`;
      els.feedback.className = 'feedback wrong';
    }

    persistStats();
    updateTopStatsUI();
    els.btnNext.classList.add('pulse');
  }

  function buildExplorer() {
    els.stackGrid.innerHTML = '';
    STACK.forEach((card, idx) => {
      const n = idx + 1;
      const key = `${n}:${card}`;
      const tile = document.createElement('button');
      tile.className = 'stack-tile';
      tile.type = 'button';
      tile.innerHTML = `
        <span class="front">#${n}</span>
        <span class="back">${card}</span>
        <span class="star">${state.stats.mastered[key] ? '⭐' : '☆'}</span>
      `;
      tile.addEventListener('click', (e) => {
        if (e.target.classList.contains('star')) return;
        tile.classList.toggle('flipped');
      });
      tile.querySelector('.star').addEventListener('click', (e) => {
        e.stopPropagation();
        state.stats.mastered[key] = !state.stats.mastered[key];
        persistStats();
        buildExplorer();
      });
      els.stackGrid.appendChild(tile);
    });
  }

  function renderStats() {
    const attempts = state.stats.attempts;
    const accuracy = attempts ? Math.round((state.stats.correct / attempts) * 100) : 0;
    const avg = attempts ? state.stats.totalMs / attempts / 1000 : 0;

    els.statAttempts.textContent = String(attempts);
    els.statAccuracy.textContent = `${accuracy}%`;
    els.statSpeed.textContent = `${avg.toFixed(1)}s`;
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
      const li = document.createElement('li');
      li.textContent = `#${num} ↔ ${card} missed ${misses} time${misses === 1 ? '' : 's'}`;
      els.weakList.appendChild(li);
    });
  }

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
        state.sessionTotal = 0;
        state.currentStreak = 0;
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
      evaluate(els.answerInput.value);
    });

    els.btnReveal.addEventListener('click', () => {
      if (!state.currentPrompt) return;
      els.feedback.innerHTML = `💡 Reveal: <strong>${state.currentPrompt.answer}</strong>`;
      els.feedback.className = 'feedback reveal';
    });

    els.btnNext.addEventListener('click', nextPrompt);

    els.btnReset.addEventListener('click', () => {
      state.stats = {
        attempts: 0,
        correct: 0,
        totalMs: 0,
        bestStreak: 0,
        missed: {},
        mastered: {},
      };
      persistStats();
      renderStats();
      buildExplorer();
    });

    document.addEventListener('keydown', (e) => {
      if (els.trainer.classList.contains('hidden')) return;
      if (e.key === 'Enter' && document.activeElement !== els.answerInput) {
        e.preventDefault();
        evaluate(els.answerInput.value);
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nextPrompt();
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        els.btnReveal.click();
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  setupEvents();
  updateTopStatsUI();
  setView('modes');
  registerServiceWorker();

  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
