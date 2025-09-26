/* Progressive Anagram Engine
   Creates a tree structure for progressive anagrams where each letter
   can be answered with YES/NO to navigate through possible words.
*/
const ProgressiveAnagram = (() => {
  
  // Simple word list for anagram generation - can be expanded
  const commonWords = [
    'cat', 'act', 'tac', 'car', 'arc', 'tar', 'rat', 'art', 'bat', 'tab',
    'dog', 'god', 'cog', 'log', 'hog', 'fog', 'bog', 'jog', 'egg', 'age',
    'tea', 'eat', 'ate', 'net', 'ten', 'pen', 'end', 'den', 'hen', 'men',
    'top', 'pot', 'opt', 'hop', 'pop', 'cop', 'mop', 'sop', 'hot', 'rot',
    'sun', 'run', 'fun', 'gun', 'nun', 'bun', 'cut', 'but', 'nut', 'gut',
    'see', 'bee', 'fee', 'tree', 'free', 'three', 'green', 'seen', 'teen',
    'moon', 'noon', 'soon', 'spoon', 'room', 'boom', 'doom', 'zoom', 'loop'
  ];

  class AnagramNode {
    constructor(letter = '', isEnd = false, word = '') {
      this.letter = letter;
      this.isEnd = isEnd;
      this.word = word;
      this.yesNode = null;
      this.noNode = null;
    }
  }

  class AnagramTree {
    constructor() {
      this.root = null;
      this.currentNode = null;
      this.path = []; // Track navigation path for undo
    }

    // Generate anagrams from input text
    generateAnagrams(text) {
      if (!text || text.trim().length === 0) return [];
      
      const cleanText = text.toLowerCase().replace(/[^a-z]/g, '');
      const letters = cleanText.split('').sort();
      
      const anagrams = [];
      
      // Find all possible anagrams using the available letters
      for (const word of commonWords) {
        if (this.canFormWord(word, letters)) {
          anagrams.push(word);
        }
      }
      
      return [...new Set(anagrams)]; // Remove duplicates
    }

    // Check if word can be formed from available letters
    canFormWord(word, availableLetters) {
      const wordLetters = word.split('').sort();
      const available = [...availableLetters];
      
      for (const letter of wordLetters) {
        const index = available.indexOf(letter);
        if (index === -1) return false;
        available.splice(index, 1);
      }
      
      return true;
    }

    // Build tree from anagrams
    buildTree(anagrams) {
      if (!anagrams || anagrams.length === 0) return null;

      // Sort anagrams by length and alphabetically
      anagrams.sort((a, b) => a.length - b.length || a.localeCompare(b));
      
      this.root = this.buildNode(anagrams, 0);
      this.currentNode = this.root;
      this.path = [this.root];
      
      return this.root;
    }

    // Recursive tree building
    buildNode(words, letterIndex) {
      if (!words || words.length === 0) return null;
      
      // Group words by their letter at current position
      const letterGroups = {};
      
      for (const word of words) {
        if (letterIndex < word.length) {
          const letter = word[letterIndex];
          if (!letterGroups[letter]) {
            letterGroups[letter] = [];
          }
          letterGroups[letter].push(word);
        }
      }
      
      // If no groups, return null
      const letters = Object.keys(letterGroups);
      if (letters.length === 0) return null;
      
      // Pick the most common letter at this position
      let bestLetter = letters[0];
      let maxCount = letterGroups[bestLetter].length;
      
      for (const letter of letters) {
        if (letterGroups[letter].length > maxCount) {
          bestLetter = letter;
          maxCount = letterGroups[letter].length;
        }
      }
      
      const node = new AnagramNode(bestLetter);
      
      // Check if any words end at this position
      const completedWords = letterGroups[bestLetter].filter(word => word.length === letterIndex + 1);
      if (completedWords.length > 0) {
        node.isEnd = true;
        node.word = completedWords[0]; // Take the first completed word
      }
      
      // Build YES branch (words that have this letter at this position)
      const yesWords = letterGroups[bestLetter].filter(word => word.length > letterIndex + 1);
      if (yesWords.length > 0) {
        node.yesNode = this.buildNode(yesWords, letterIndex + 1);
      }
      
      // Build NO branch (words that don't have this letter at this position)
      const noWords = [];
      for (const letter of letters) {
        if (letter !== bestLetter) {
          noWords.push(...letterGroups[letter]);
        }
      }
      if (noWords.length > 0) {
        node.noNode = this.buildNode(noWords, letterIndex);
      }
      
      return node;
    }

    // Navigate tree with YES
    navigateYes() {
      if (!this.currentNode || !this.currentNode.yesNode) return false;
      
      this.currentNode = this.currentNode.yesNode;
      this.path.push(this.currentNode);
      return true;
    }

    // Navigate tree with NO
    navigateNo() {
      if (!this.currentNode || !this.currentNode.noNode) return false;
      
      this.currentNode = this.currentNode.noNode;
      this.path.push(this.currentNode);
      return true;
    }

    // Undo last navigation
    undo() {
      if (this.path.length <= 1) return false; // Can't undo from root
      
      this.path.pop();
      this.currentNode = this.path[this.path.length - 1];
      return true;
    }

    // Get current letter to display
    getCurrentLetter() {
      return this.currentNode ? this.currentNode.letter : '';
    }

    // Check if current position is end of word
    isAtEnd() {
      return this.currentNode ? this.currentNode.isEnd : false;
    }

    // Get completed word if at end
    getCompletedWord() {
      return (this.currentNode && this.currentNode.isEnd) ? this.currentNode.word : '';
    }

    // Reset tree
    reset() {
      this.currentNode = this.root;
      this.path = this.root ? [this.root] : [];
    }

    // Check if navigation is possible
    canNavigateYes() {
      return this.currentNode && this.currentNode.yesNode !== null;
    }

    canNavigateNo() {
      return this.currentNode && this.currentNode.noNode !== null;
    }
  }

  // Public API
  return {
    create: () => new AnagramTree(),
    
    // Utility function to create and setup tree from text
    createFromText: (text) => {
      const tree = new AnagramTree();
      const anagrams = tree.generateAnagrams(text);
      tree.buildTree(anagrams);
      return tree;
    }
  };
})();