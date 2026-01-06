// Date Quizzer App
(function() {
  'use strict';

  // State
  let doomsdays = [];
  let currentMode = null;
  let currentQuestion = null;
  let score = 0;
  let totalQuestions = 0;
  let usedQuestions = new Set();
  let sessionQuestions = 0;
  let currentStreak = 0;

  // Settings State
  let settings = {
    decadeFilters: [1970, 1980, 1990, 2000, 2010, 2020],
    yearRangeStart: null,
    yearRangeEnd: null,
    quizLength: -1,
    difficulty: 'medium',
    practiceMode: false,
    timedMode: false,
    focusWeakAreas: false,
    keyboardShortcuts: true
  };

  // Statistics State
  let statistics = {
    totalQuestions: 0,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    yearStats: {}, // { year: { correct, incorrect } }
    weekdayConfusion: {} // { actual: { guessed: count } }
  };

  // DOM Elements
  const modeSelection = document.getElementById('modeSelection');
  const quizContainer = document.getElementById('quizContainer');
  const memoryContainer = document.getElementById('memoryContainer');
  const datePickerContainer = document.getElementById('datePickerContainer');
  const statisticsContainer = document.getElementById('statisticsContainer');
  const settingsContainer = document.getElementById('settingsContainer');
  const questionLabel = document.getElementById('questionLabel');
  const questionValue = document.getElementById('questionValue');
  const answerGrid = document.getElementById('answerGrid');
  const feedback = document.getElementById('feedback');
  const feedbackIcon = document.getElementById('feedbackIcon');
  const feedbackText = document.getElementById('feedbackText');
  const nextContainer = document.getElementById('nextContainer');
  const scoreDisplay = document.getElementById('score');
  const totalDisplay = document.getElementById('total');
  const accuracyDisplay = document.getElementById('accuracy');
  const progressIndicator = document.getElementById('progressIndicator');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  // Initialize
  async function init() {
    try {
      await loadDoomsdays();
      loadSettings();
      loadStatistics();
      setupEventListeners();
      setupKeyboardShortcuts();
    } catch (error) {
      console.error('Failed to initialize:', error);
      alert('Failed to load doomsday data. Please refresh the page.');
    }
  }

  // Load CSV data
  async function loadDoomsdays() {
    try {
      const response = await fetch('doomsdays.csv');
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.statusText}`);
      }
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      // Skip header and filter out empty lines
      doomsdays = lines.slice(1)
        .filter(line => line.trim().length > 0)
        .map(line => {
          const [year, doomsday] = line.split(',');
          const yearNum = parseInt(year);
          return {
            year: yearNum,
            doomsday: doomsday.trim(),
            isLeap: isLeapYear(yearNum),
            isMilestone: yearNum % 5 === 0,
            decade: Math.floor(yearNum / 10) * 10
          };
        });
    } catch (error) {
      console.error('Error loading doomsdays:', error);
      throw error;
    }
  }

  // localStorage utilities
  function loadSettings() {
    const saved = localStorage.getItem('dateQuizzerSettings');
    if (saved) {
      try {
        settings = { ...settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('dateQuizzerSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  function loadStatistics() {
    const saved = localStorage.getItem('dateQuizzerStats');
    if (saved) {
      try {
        statistics = { ...statistics, ...JSON.parse(saved) };
        currentStreak = statistics.currentStreak || 0;
      } catch (e) {
        console.error('Failed to load statistics:', e);
      }
    }
  }

  function saveStatistics() {
    try {
      localStorage.setItem('dateQuizzerStats', JSON.stringify(statistics));
    } catch (e) {
      console.error('Failed to save statistics:', e);
    }
  }

  function updateStatistics(year, isCorrect, actualWeekday, guessedWeekday) {
    statistics.totalQuestions++;
    
    if (isCorrect) {
      statistics.correctAnswers++;
      currentStreak++;
      statistics.currentStreak = currentStreak;
      statistics.bestStreak = Math.max(statistics.bestStreak || 0, currentStreak);
    } else {
      currentStreak = 0;
      statistics.currentStreak = 0;
    }

    // Update year stats
    if (!statistics.yearStats[year]) {
      statistics.yearStats[year] = { correct: 0, incorrect: 0 };
    }
    if (isCorrect) {
      statistics.yearStats[year].correct++;
    } else {
      statistics.yearStats[year].incorrect++;
    }

    // Update weekday confusion matrix (only for date-to-weekday mode)
    if (actualWeekday && guessedWeekday && currentMode === 'date-to-weekday') {
      if (!statistics.weekdayConfusion[actualWeekday]) {
        statistics.weekdayConfusion[actualWeekday] = {};
      }
      if (!statistics.weekdayConfusion[actualWeekday][guessedWeekday]) {
        statistics.weekdayConfusion[actualWeekday][guessedWeekday] = 0;
      }
      statistics.weekdayConfusion[actualWeekday][guessedWeekday]++;
    }

    saveStatistics();
  }

  // Check if year is leap year
  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Mode selection buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        startMode(currentMode);
      });
    });

    // Back buttons
    document.getElementById('btnBack').addEventListener('click', backToMenu);
    document.getElementById('btnBackMemory').addEventListener('click', backToMenu);
    document.getElementById('btnBackDatePicker').addEventListener('click', backToMenu);
    document.getElementById('btnBackStats').addEventListener('click', backToMenu);
    document.getElementById('btnBackSettings').addEventListener('click', backToMenu);

    // Next button
    document.getElementById('btnNext').addEventListener('click', nextQuestion);

    // Date picker
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
      dateInput.addEventListener('change', handleDateSelection);
    }

    // Statistics
    const btnResetStats = document.getElementById('btnResetStats');
    if (btnResetStats) {
      btnResetStats.addEventListener('click', resetStatistics);
    }

    // Settings
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', handleSaveSettings);
    }
  }

  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!settings.keyboardShortcuts) return;
      if (quizContainer.classList.contains('hidden')) return;

      // 1-7 for weekdays
      if (e.key >= '1' && e.key <= '7') {
        const buttons = answerGrid.querySelectorAll('.answer-btn:not(:disabled)');
        const index = parseInt(e.key) - 1;
        if (buttons[index]) {
          buttons[index].click();
        }
      }

      // Enter for next question
      if (e.key === 'Enter' && !nextContainer.classList.contains('hidden')) {
        document.getElementById('btnNext').click();
      }
    });
  }

  // Start selected mode
  function startMode(mode) {
    modeSelection.classList.add('hidden');
    score = 0;
    totalQuestions = 0;
    sessionQuestions = 0;
    usedQuestions.clear();
    updateScore();

    if (mode === 'memory-helper') {
      showMemoryHelper();
    } else if (mode === 'date-picker') {
      showDatePicker();
    } else if (mode === 'statistics') {
      showStatistics();
    } else if (mode === 'settings') {
      showSettings();
    } else {
      quizContainer.classList.remove('hidden');
      updateProgressIndicator();
      nextQuestion();
    }
  }

  // Back to main menu
  function backToMenu() {
    quizContainer.classList.add('hidden');
    memoryContainer.classList.add('hidden');
    datePickerContainer.classList.add('hidden');
    statisticsContainer.classList.add('hidden');
    settingsContainer.classList.add('hidden');
    modeSelection.classList.remove('hidden');
    currentMode = null;
  }

  // Constants for weak area detection
  const WEAK_ACCURACY_THRESHOLD = 0.6;
  const MIN_ATTEMPTS_FOR_WEAK_DETECTION = 2;
  const WEAK_AREA_WEIGHT = 0.7;

  // Get filtered doomsdays based on settings
  function getFilteredDoomsdays() {
    let filtered = [...doomsdays];

    // Apply decade filters
    if (settings.decadeFilters.length > 0) {
      filtered = filtered.filter(d => settings.decadeFilters.includes(d.decade));
    }

    // Apply year range
    if (settings.yearRangeStart && settings.yearRangeEnd) {
      filtered = filtered.filter(d => 
        d.year >= settings.yearRangeStart && d.year <= settings.yearRangeEnd
      );
    }

    // Apply difficulty
    if (settings.difficulty === 'easy') {
      filtered = filtered.filter(d => d.isMilestone);
    } else if (settings.difficulty === 'hard') {
      filtered = filtered.filter(d => !d.isMilestone);
    }

    // Focus on weak areas
    if (settings.focusWeakAreas && statistics.yearStats) {
      const weakYears = Object.keys(statistics.yearStats)
        .filter(year => {
          const stats = statistics.yearStats[year];
          const total = stats.correct + stats.incorrect;
          const accuracy = total > 0 ? stats.correct / total : 1;
          return accuracy < WEAK_ACCURACY_THRESHOLD && total >= MIN_ATTEMPTS_FOR_WEAK_DETECTION;
        })
        .map(y => parseInt(y));

      if (weakYears.length > 0) {
        const weakDoomsdays = filtered.filter(d => weakYears.includes(d.year));
        // 70% weak areas, 30% random
        if (weakDoomsdays.length > 0 && Math.random() < WEAK_AREA_WEIGHT) {
          filtered = weakDoomsdays;
        }
      }
    }

    return filtered;
  }

  // Get random unique question
  function getRandomQuestion() {
    const availableQuestions = getFilteredDoomsdays().filter(d => !usedQuestions.has(d.year));
    
    // Reset if we've used all questions
    if (availableQuestions.length === 0) {
      usedQuestions.clear();
      const allFiltered = getFilteredDoomsdays();
      return allFiltered[Math.floor(Math.random() * allFiltered.length)];
    }
    
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }

  // Update progress indicator
  function updateProgressIndicator() {
    if (settings.quizLength > 0) {
      progressIndicator.classList.remove('hidden');
      const progress = (sessionQuestions / settings.quizLength) * 100;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `Question ${sessionQuestions + 1} of ${settings.quizLength}`;
    } else {
      progressIndicator.classList.add('hidden');
    }
  }

  // Generate next question
  function nextQuestion() {
    // Check if quiz is complete
    if (settings.quizLength > 0 && sessionQuestions >= settings.quizLength) {
      showQuizComplete();
      return;
    }

    // Hide feedback and next button
    feedback.classList.add('hidden');
    nextContainer.classList.add('hidden');

    currentQuestion = getRandomQuestion();
    usedQuestions.add(currentQuestion.year);
    sessionQuestions++;
    updateProgressIndicator();

    switch (currentMode) {
      case 'year-to-doomsday':
        showYearToDoomsday();
        break;
      case 'doomsday-to-year':
        showDoomsdayToYear();
        break;
      case 'date-to-weekday':
        showDateToWeekday();
        break;
    }
  }

  // Show quiz complete message
  function showQuizComplete() {
    feedback.classList.remove('hidden', 'correct', 'incorrect');
    feedback.classList.add('correct');
    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    
    feedbackIcon.textContent = '🎉';
    feedbackText.innerHTML = `
      <div class="feedback-text">Quiz Complete!</div>
      <div class="feedback-detail">You scored ${score}/${totalQuestions} (${accuracy}%)</div>
    `;
    
    nextContainer.classList.remove('hidden');
    document.getElementById('btnNext').textContent = 'Back to Menu';
    document.getElementById('btnNext').removeEventListener('click', nextQuestion);
    document.getElementById('btnNext').addEventListener('click', backToMenu, { once: true });
  }

  // Year to Doomsday mode
  function showYearToDoomsday() {
    questionLabel.textContent = 'What is the doomsday for:';
    const yearDisplay = currentQuestion.year + 
      (currentQuestion.isLeap ? '*' : '') + 
      (currentQuestion.isMilestone ? ' (milestone)' : '');
    questionValue.textContent = yearDisplay;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const correctAnswer = currentQuestion.doomsday;
    
    // Create shuffled options
    const options = shuffleArray([...days]);
    
    renderAnswerButtons(options, correctAnswer);
  }

  // Doomsday to Year mode
  function showDoomsdayToYear() {
    questionLabel.textContent = 'Which year has this doomsday:';
    questionValue.textContent = currentQuestion.doomsday;

    const correctAnswer = currentQuestion.year.toString();
    
    // Create options with correct year and 3 random wrong years
    const wrongYearsList = doomsdays
      .filter(d => d.year !== currentQuestion.year)
      .map(d => d.year.toString());
    const shuffledWrongYears = shuffleArray(wrongYearsList);
    const wrongYears = shuffledWrongYears.slice(0, 3);
    
    const options = shuffleArray([correctAnswer, ...wrongYears]);
    
    renderAnswerButtons(options, correctAnswer);
  }

  // Date to Weekday mode
  function showDateToWeekday() {
    // Generate a random date in the selected year
    const year = currentQuestion.year;
    const month = Math.floor(Math.random() * 12) + 1; // 1-12
    const maxDay = new Date(year, month, 0).getDate();
    const day = Math.floor(Math.random() * maxDay) + 1; // 1-maxDay

    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    questionLabel.textContent = 'What day of the week is:';
    questionValue.textContent = `${date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })}`;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const options = shuffleArray([...days]);

    renderAnswerButtons(options, dayOfWeek);
  }

  // Render answer buttons
  function renderAnswerButtons(options, correctAnswer) {
    answerGrid.innerHTML = '';
    answerGrid.className = 'answer-grid';

    // Use single column for year mode (4 options)
    if (currentMode === 'doomsday-to-year') {
      answerGrid.classList.add('single-column');
    }

    options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => handleAnswer(option, correctAnswer, btn));
      answerGrid.appendChild(btn);
    });
  }

  // Handle answer selection
  function handleAnswer(selectedAnswer, correctAnswer, selectedButton) {
    totalQuestions++;
    const isCorrect = selectedAnswer === correctAnswer;

    if (isCorrect) {
      score++;
      selectedButton.classList.add('correct');
      showFeedback(true, correctAnswer);
    } else {
      selectedButton.classList.add('incorrect');
      showFeedback(false, correctAnswer);
      
      // Highlight correct answer
      const buttons = answerGrid.querySelectorAll('.answer-btn');
      buttons.forEach(btn => {
        if (btn.textContent === correctAnswer) {
          btn.classList.add('correct');
        }
      });
    }

    // Update statistics
    let actualWeekday = null;
    let guessedWeekday = null;
    if (currentMode === 'date-to-weekday') {
      actualWeekday = correctAnswer;
      guessedWeekday = selectedAnswer;
    }
    updateStatistics(currentQuestion.year, isCorrect, actualWeekday, guessedWeekday);

    // Disable all buttons
    const buttons = answerGrid.querySelectorAll('.answer-btn');
    buttons.forEach(btn => btn.disabled = true);

    updateScore();
    
    // In practice mode, show explanation
    if (settings.practiceMode) {
      showPracticeExplanation();
    }
    
    nextContainer.classList.remove('hidden');
    document.getElementById('btnNext').textContent = 'Next Question →';
    document.getElementById('btnNext').removeEventListener('click', backToMenu);
    document.getElementById('btnNext').addEventListener('click', nextQuestion);
  }

  // Show practice mode explanation
  function showPracticeExplanation() {
    const explanation = document.createElement('div');
    explanation.className = 'practice-explanation';
    explanation.style.cssText = 'margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 12px; font-size: 0.9rem;';
    
    let content = `<strong>Year ${currentQuestion.year}</strong><br>`;
    content += `Doomsday: ${currentQuestion.doomsday}<br>`;
    content += `${currentQuestion.isLeap ? '🔹 Leap Year' : ''} ${currentQuestion.isMilestone ? '⭐ Milestone' : ''}`;
    
    explanation.innerHTML = content;
    feedback.appendChild(explanation);
  }

  // Show feedback
  function showFeedback(isCorrect, correctAnswer) {
    feedback.classList.remove('hidden', 'correct', 'incorrect');
    feedback.classList.add(isCorrect ? 'correct' : 'incorrect');

    feedbackIcon.textContent = isCorrect ? '✓' : '✗';
    
    if (isCorrect) {
      feedbackText.innerHTML = '<div class="feedback-text">Correct!</div>';
    } else {
      feedbackText.innerHTML = `
        <div class="feedback-text">Incorrect</div>
        <div class="feedback-detail">The correct answer is: ${correctAnswer}</div>
      `;
    }
  }

  // Update score display
  function updateScore() {
    scoreDisplay.textContent = score;
    totalDisplay.textContent = totalQuestions;
    
    if (totalQuestions > 0) {
      const accuracy = Math.round((score / totalQuestions) * 100);
      accuracyDisplay.textContent = `${accuracy}%`;
    } else {
      accuracyDisplay.textContent = '';
    }
  }

  // Show memory helper
  function showMemoryHelper() {
    memoryContainer.classList.remove('hidden');
    const memoryGrid = document.getElementById('memoryGrid');
    memoryGrid.innerHTML = '';

    doomsdays.forEach(data => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      if (data.isMilestone) {
        card.classList.add('highlighted');
      }

      let badges = '';
      if (data.isLeap) {
        badges += '<span class="year-badge">Leap</span>';
      }
      if (data.isMilestone) {
        badges += '<span class="year-badge">★</span>';
      }

      card.innerHTML = `
        <div class="memory-year">
          ${data.year}
          ${badges ? `<span class="year-badges">${badges}</span>` : ''}
        </div>
        <div class="memory-doomsday">${data.doomsday}</div>
      `;
      
      memoryGrid.appendChild(card);
    });
  }

  // Show date picker
  function showDatePicker() {
    datePickerContainer.classList.remove('hidden');
    const dateInput = document.getElementById('dateInput');
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
    handleDateSelection();
  }

  // Handle date selection
  function handleDateSelection() {
    const dateInput = document.getElementById('dateInput');
    const dateResult = document.getElementById('dateResult');
    
    if (!dateInput.value) return;
    
    // Parse date from input value (YYYY-MM-DD format)
    const [year, month, day] = dateInput.value.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);

    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = selectedDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });

    // Find doomsday for this year
    const yearData = doomsdays.find(d => d.year === year);
    const doomsday = yearData ? yearData.doomsday : 'N/A';
    const isLeap = isLeapYear(year);

    document.getElementById('resultDate').textContent = dateStr;
    document.getElementById('resultWeekday').textContent = dayOfWeek;
    document.getElementById('resultYear').textContent = year;
    document.getElementById('resultDoomsday').textContent = doomsday;
    document.getElementById('resultLeap').textContent = isLeap ? 'Yes' : 'No';

    dateResult.classList.remove('hidden');
  }

  // Show statistics
  function showStatistics() {
    statisticsContainer.classList.remove('hidden');
    
    // Overall stats
    const accuracy = statistics.totalQuestions > 0 
      ? Math.round((statistics.correctAnswers / statistics.totalQuestions) * 100) 
      : 0;
    
    document.getElementById('statTotal').textContent = statistics.totalQuestions;
    document.getElementById('statCorrect').textContent = statistics.correctAnswers;
    document.getElementById('statAccuracy').textContent = `${accuracy}%`;
    document.getElementById('statStreak').textContent = statistics.currentStreak;

    // Decade stats
    showDecadeStats();

    // Weekday confusion matrix
    showConfusionMatrix();
  }

  // Show decade statistics
  function showDecadeStats() {
    const decadeStats = document.getElementById('decadeStats');
    decadeStats.innerHTML = '';

    const decades = [1970, 1980, 1990, 2000, 2010, 2020];
    
    decades.forEach(decade => {
      const decadeYears = doomsdays.filter(d => d.decade === decade).map(d => d.year);
      let correct = 0;
      let total = 0;

      decadeYears.forEach(year => {
        if (statistics.yearStats[year]) {
          correct += statistics.yearStats[year].correct;
          total += statistics.yearStats[year].correct + statistics.yearStats[year].incorrect;
        }
      });

      if (total === 0) return; // Skip decades with no data

      const accuracy = Math.round((correct / total) * 100);
      const isWeak = accuracy < 60;

      const decadeDiv = document.createElement('div');
      decadeDiv.className = 'decade-stat';
      decadeDiv.innerHTML = `
        <div class="decade-header">
          <span class="decade-name">${decade}s</span>
          <span class="decade-accuracy ${isWeak ? 'weak' : ''}">${accuracy}%</span>
        </div>
        <div class="decade-bar">
          <div class="decade-fill ${isWeak ? 'weak' : ''}" style="width: ${accuracy}%"></div>
        </div>
        <div class="decade-details">${correct} correct out of ${total} questions</div>
      `;

      decadeStats.appendChild(decadeDiv);
    });

    if (decadeStats.children.length === 0) {
      decadeStats.innerHTML = '<p class="subtitle">No statistics yet. Start a quiz to see your progress!</p>';
    }
  }

  // Show weekday confusion matrix
  function showConfusionMatrix() {
    const matrixContainer = document.getElementById('confusionMatrix');
    matrixContainer.innerHTML = '';

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Check if we have any data
    const hasData = Object.keys(statistics.weekdayConfusion).length > 0;
    
    if (!hasData) {
      matrixContainer.innerHTML = '<p class="subtitle">No weekday data yet. Complete some "Date → Weekday" quizzes to see confusion patterns!</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'matrix-table';

    // Header row
    let headerRow = '<tr><th>Actual</th>';
    weekdays.forEach(day => {
      headerRow += `<th>${day.substring(0, 3)}</th>`;
    });
    headerRow += '</tr>';
    table.innerHTML = headerRow;

    // Data rows
    weekdays.forEach(actualDay => {
      const row = document.createElement('tr');
      row.innerHTML = `<th>${actualDay.substring(0, 3)}</th>`;
      
      weekdays.forEach(guessedDay => {
        const count = statistics.weekdayConfusion[actualDay]?.[guessedDay] || 0;
        const isHigh = count >= 3 && actualDay !== guessedDay;
        const cell = document.createElement('td');
        cell.className = isHigh ? 'matrix-cell high' : 'matrix-cell';
        cell.textContent = count || '-';
        if (actualDay === guessedDay) {
          cell.style.background = 'rgba(110, 231, 183, 0.15)';
          cell.style.fontWeight = '700';
        }
        row.appendChild(cell);
      });
      
      table.appendChild(row);
    });

    matrixContainer.appendChild(table);
  }

  // Reset statistics
  function resetStatistics() {
    if (!confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      return;
    }

    statistics = {
      totalQuestions: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bestStreak: 0,
      yearStats: {},
      weekdayConfusion: {}
    };
    currentStreak = 0;

    saveStatistics();
    showStatistics();
  }

  // Show settings
  function showSettings() {
    settingsContainer.classList.remove('hidden');
    
    // Load current settings into UI
    document.querySelectorAll('#decadeFilters input[type="checkbox"]').forEach(cb => {
      cb.checked = settings.decadeFilters.includes(parseInt(cb.value));
    });
    
    document.getElementById('yearRangeStart').value = settings.yearRangeStart || '';
    document.getElementById('yearRangeEnd').value = settings.yearRangeEnd || '';
    document.getElementById('quizLength').value = settings.quizLength;
    document.getElementById('difficulty').value = settings.difficulty;
    document.getElementById('practiceMode').checked = settings.practiceMode;
    document.getElementById('timedMode').checked = settings.timedMode;
    document.getElementById('focusWeakAreas').checked = settings.focusWeakAreas;
    document.getElementById('keyboardShortcuts').checked = settings.keyboardShortcuts;
  }

  // Handle save settings
  function handleSaveSettings() {
    // Decade filters
    const decadeCheckboxes = document.querySelectorAll('#decadeFilters input[type="checkbox"]');
    settings.decadeFilters = Array.from(decadeCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value));

    // Year range
    const yearStart = document.getElementById('yearRangeStart').value;
    const yearEnd = document.getElementById('yearRangeEnd').value;
    settings.yearRangeStart = yearStart ? parseInt(yearStart) : null;
    settings.yearRangeEnd = yearEnd ? parseInt(yearEnd) : null;

    // Quiz options
    settings.quizLength = parseInt(document.getElementById('quizLength').value);
    settings.difficulty = document.getElementById('difficulty').value;
    settings.practiceMode = document.getElementById('practiceMode').checked;
    settings.timedMode = document.getElementById('timedMode').checked;
    settings.focusWeakAreas = document.getElementById('focusWeakAreas').checked;
    settings.keyboardShortcuts = document.getElementById('keyboardShortcuts').checked;

    saveSettings();
    
    // Show confirmation
    alert('Settings saved successfully!');
  }

  // Utility: Shuffle array
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Start the app
  init();
})();
