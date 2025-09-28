/* PROGRESSIVE ANAGRAM BACKGROUND SERVICE
   For integration with other apps like Hangman
   Provides a simple API for word guessing assistance
*/

const AnagramService = (() => {
  let currentSession = null;
  let isInitialized = false;

  // Initialize with a word list
  function initialize(words, options = {}) {
    try {
      if (!words || words.length < 2) {
        throw new Error('Need at least 2 words to initialize anagram service');
      }
      
      const tree = Anagram.buildTree(words, options);
      currentSession = Anagram.createSession(tree);
      isInitialized = true;
      
      return {
        success: true,
        wordCount: words.length,
        firstQuestion: currentSession.getQuestion()
      };
    } catch (error) {
      console.error('AnagramService initialization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get the current question
  function getCurrentQuestion() {
    if (!isInitialized || !currentSession) {
      return null;
    }
    
    if (currentSession.done()) {
      return null;
    }
    
    return {
      question: currentSession.getQuestion(),
      step: currentSession.path().length + 1
    };
  }

  // Answer the current question
  function answerQuestion(yes) {
    if (!isInitialized || !currentSession) {
      return { success: false, error: 'Service not initialized' };
    }
    
    if (currentSession.done()) {
      return { success: false, error: 'Session already completed' };
    }
    
    currentSession.answer(yes);
    
    if (currentSession.done()) {
      return {
        success: true,
        completed: true,
        result: currentSession.result(),
        path: currentSession.path()
      };
    } else {
      return {
        success: true,
        completed: false,
        nextQuestion: currentSession.getQuestion(),
        step: currentSession.path().length + 1
      };
    }
  }

  // Get current status
  function getStatus() {
    if (!isInitialized || !currentSession) {
      return { initialized: false };
    }
    
    return {
      initialized: true,
      completed: currentSession.done(),
      currentQuestion: currentSession.getQuestion(),
      step: currentSession.path().length + 1,
      path: currentSession.path(),
      result: currentSession.done() ? currentSession.result() : null
    };
  }

  // Reset the session with the same word list
  function reset() {
    if (!isInitialized) {
      return { success: false, error: 'Service not initialized' };
    }
    
    // This would require storing the original words, let's add that
    return { success: false, error: 'Reset requires re-initialization with word list' };
  }

  // Helper to load words from storage
  function loadWordsFromStorage(storageKey = 'anagram') {
    try {
      const config = Storage.load(storageKey, { wordList: '' });
      if (!config.wordList) {
        return [];
      }
      
      return config.wordList
        .split(/[,\n]/)
        .map(w => w.trim())
        .filter(w => w);
    } catch (error) {
      console.error('Error loading words from storage:', error);
      return [];
    }
  }

  // Quick initialization from storage
  function initializeFromStorage(storageKey = 'anagram') {
    const words = loadWordsFromStorage(storageKey);
    const config = Storage.load(storageKey, { useEntropy: false });
    
    return initialize(words, { entropy: config.useEntropy });
  }

  // Public API
  return {
    initialize,
    initializeFromStorage,
    getCurrentQuestion,
    answerQuestion,
    getStatus,
    reset,
    loadWordsFromStorage,
    
    // Convenience getters
    get isReady() { return isInitialized; },
    get isCompleted() { return currentSession && currentSession.done(); }
  };
})();