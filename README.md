# Magic Ideas

A collection of interactive magic tricks and apps for mobile devices.

## Available Tricks

### Swipe Input
A gesture-based input system that allows users to enter digits by swiping in different directions on a clock-face pattern.

### Drawing with Progressive Anagrams
A drawing app integrated with progressive anagram functionality that operates in the background.

## Progressive Anagram Drawing App

### Features

#### Core Drawing Functionality
- HTML5 Canvas-based drawing with touch and mouse support
- Real-time drawing with customizable stroke properties
- Full-screen drawing surface

#### Progressive Anagram Integration
- **Secret Word Bank**: Stores words for anagram generation
- **Automatic Clipboard Paste**: When word bank is empty, tapping the canvas attempts to paste clipboard content
- **Progressive Anagram Tree**: Creates a navigable tree structure from input words
- **API-like Integration**: Anagram functionality runs independently without interfering with drawing

#### Interactive Navigation
- **Canvas Zones**: 
  - Upper third = "NO" response
  - Lower third = "YES" response
- **Tree Navigation**: Navigate through anagram tree using canvas taps
- **Letter Display**: Shows current letter in bottom-right corner
- **Word Completion**: Displays completed word when reaching tree end

#### Debug Features
- **Debug Mode Toggle**: ON/OFF switch for debug functionality
- **Debug Information Panel**: Shows word bank status, anagram readiness, tree position, and last action
- **DEBUG Button**: Displays comprehensive debug information
- **Zone Indicators**: Visual feedback for NO/YES zones during navigation

#### Controls
- **Undo**: Return to previous step in anagram tree
- **Clear**: Reset canvas, word bank, and anagram tree completely
- **Debug Toggle**: Enable/disable debug mode
- **DEBUG**: Show detailed debug information

### Usage

1. **Basic Drawing**: 
   - Open the drawing app
   - Draw on the white canvas using mouse or touch

2. **Adding Words for Anagrams**:
   - With empty word bank, tap anywhere on canvas to paste from clipboard
   - Or manually enter text when prompted

3. **Using Progressive Anagrams**:
   - Enable debug mode to see anagram navigation
   - Once word bank has content, progressive anagram tree is generated
   - Tap upper third of canvas for "NO"
   - Tap lower third of canvas for "YES"
   - Navigate through the tree to spell out words

4. **Debug Mode**:
   - Toggle debug mode ON to see all information panels
   - Use DEBUG button to get comprehensive status
   - Monitor word bank, anagram readiness, and tree position

### Technical Implementation

#### Modular Design
- `ProgressiveAnagram` module handles all anagram logic independently
- `DrawingApp` class manages the drawing interface and user interactions
- Clean separation between drawing and anagram functionalities

#### Progressive Anagram Engine
- Generates anagrams from input text using a built-in word dictionary
- Builds a binary tree structure for navigation
- Supports YES/NO navigation through letter choices
- Tracks navigation path for undo functionality

#### State Management
- Uses localStorage for persistence
- Saves debug mode preferences and word bank
- Maintains application state across sessions

### Files Structure

```
tricks/drawing/
├── draw.html           # Main drawing app interface
assets/js/
├── anagram.js          # Progressive anagram engine
├── storage.js          # State persistence utility
├── gestures.js         # Touch gesture handling (existing)
└── swipe.js           # Swipe input functionality (existing)
```

### Future Expansions

The modular design allows for easy expansion:
- Additional word dictionaries
- More complex anagram algorithms
- Enhanced drawing tools
- Multi-language support
- Custom tree traversal methods