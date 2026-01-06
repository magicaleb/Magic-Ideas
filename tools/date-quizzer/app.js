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

  // DOM Elements
  const modeSelection = document.getElementById('modeSelection');
  const quizContainer = document.getElementById('quizContainer');
  const memoryContainer = document.getElementById('memoryContainer');
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

  // Initialize
  async function init() {
    try {
      await loadDoomsdays();
      setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize:', error);
      alert('Failed to load doomsday data. Please refresh the page.');
    }
  }

  // Load CSV data
  async function loadDoomsdays() {
    const response = await fetch('doomsdays.csv');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // Skip header
    doomsdays = lines.slice(1).map(line => {
      const [year, doomsday] = line.split(',');
      return {
        year: parseInt(year),
        doomsday: doomsday.trim(),
        isLeap: isLeapYear(parseInt(year)),
        isMilestone: parseInt(year) % 5 === 0
      };
    });
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

    // Next button
    document.getElementById('btnNext').addEventListener('click', nextQuestion);
  }

  // Start selected mode
  function startMode(mode) {
    modeSelection.classList.add('hidden');
    score = 0;
    totalQuestions = 0;
    usedQuestions.clear();
    updateScore();

    if (mode === 'memory-helper') {
      showMemoryHelper();
    } else {
      quizContainer.classList.remove('hidden');
      nextQuestion();
    }
  }

  // Back to main menu
  function backToMenu() {
    quizContainer.classList.add('hidden');
    memoryContainer.classList.add('hidden');
    modeSelection.classList.remove('hidden');
    currentMode = null;
  }

  // Get random unique question
  function getRandomQuestion() {
    const availableQuestions = doomsdays.filter(d => !usedQuestions.has(d.year));
    
    // Reset if we've used all questions
    if (availableQuestions.length === 0) {
      usedQuestions.clear();
      return doomsdays[Math.floor(Math.random() * doomsdays.length)];
    }
    
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }

  // Generate next question
  function nextQuestion() {
    // Hide feedback and next button
    feedback.classList.add('hidden');
    nextContainer.classList.add('hidden');

    currentQuestion = getRandomQuestion();
    usedQuestions.add(currentQuestion.year);

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
    const wrongYears = doomsdays
      .filter(d => d.year !== currentQuestion.year)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(d => d.year.toString());
    
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

    // Disable all buttons
    const buttons = answerGrid.querySelectorAll('.answer-btn');
    buttons.forEach(btn => btn.disabled = true);

    updateScore();
    nextContainer.classList.remove('hidden');
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
