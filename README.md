# Magic Ideas

A collection of interactive tricks and tools with advanced gesture-based input systems for mobile devices.

## Features

- 📱 **Touch-Optimized**: Built for mobile-first experience
- 👆 **Gesture Input System**: Modular swipe-based input with multiple modes
- 🎨 **Interactive Tricks**: Various visual and input demonstrations
- 🔧 **Configurable**: Multiple input modes with customizable settings
- 💾 **Persistent Storage**: Settings and preferences saved across sessions
- 🚫 **No Scrolling**: Locked viewport prevents unwanted interactions

## Gesture Input System

The app includes a modular gesture input system with multiple input modes that can be used for interactive tricks.

### Available Input Modes

#### Clock Face Mode (Default)
- **How it works**: Swipe in any direction to select one of 12 positions (like a clock face)
- **Usage**: Each position is determined by the angle of your swipe
- **Best for**: Quick, single-gesture selection
- **Provides**: Immediate feedback on selection

#### Two-Swipe Mode
A more precise two-step input method:

1. **First Swipe**: Select a base position from 4 cardinal directions
   - Swipe Up → 12 o'clock
   - Swipe Right → 3 o'clock
   - Swipe Down → 6 o'clock
   - Swipe Left → 9 o'clock

2. **Second Swipe**: Fine-tune your selection
   - Same direction as first swipe → Exact base position
   - Forward/Up relative to first → +1 position
   - Backward/Down relative to first → -1 position

**Example**: Swipe Right (3 o'clock) then Swipe Up (+1) = 4 o'clock

**Timeout**: If the second swipe is not completed within 3 seconds, the mode resets to the first swipe stage.

### Try the Demo

Open [gesture-input-demo.html](./gesture-input-demo.html) to try out the different input modes interactively.

## Tricks

### Swipe Input
A fullscreen swipe-based numeric input system perfect for magic tricks and remote number entry.

- **Location**: `tricks/swipe/`
- **Features**: 
  - Maps swipe directions to digits (1-9, 0)
  - Double-tap to clear
  - Two-finger tap to submit
  - Configurable auto-submit delay
  - Clipboard support
  - iOS Shortcuts integration
  - Fake homescreen mode for performance

### Contained Swipe Input
A variant of the swipe input with a contained interface.

### Hangman Drawing
Interactive drawing trick for the classic hangman game.

## Tools

### Time Travel
A time manipulation utility.

### Simple PWA Demo
Demonstrates Progressive Web App capabilities.

### Simple Image Demo
Basic image handling demonstration.

## Technical Architecture

### Gesture System Files

The modular gesture input system is built with three core JavaScript files:

#### `assets/js/gestureDetector.js`
Base gesture detection handling touch events:
- Detects swipe direction (up, down, left, right)
- Calculates delta X/Y for precise angle determination
- Configurable minimum swipe distance
- Event listener management with proper cleanup

#### `assets/js/inputModes.js`
Input mode implementations and management:
- **ClockFaceMode class**: Direct angle-to-position mapping (12 positions)
- **TwoSwipeMode class**: Two-stage input with base position and refinement
- **InputModeManager class**: Mode switching and state management
- Each mode implements:
  - `processGesture(gesture)` - Handle gesture input
  - `getState()` - Return current state for UI feedback
  - `reset()` - Reset internal state
  - `onCompletion(callback)` - Register completion callback

#### Legacy Gesture Files

The repository also includes legacy gesture handling:

- **`assets/js/gestures.js`**: Original gesture detection (swipe angle, double-tap, two-finger gestures)
- **`assets/js/swipe.js`**: Original swipe engine that maps swipe angles to digits

These files are still used by the existing tricks for backward compatibility.

### Adding New Input Modes

To add a new input mode:

1. Create a new class in `assets/js/inputModes.js` implementing:
   ```javascript
   class MyCustomMode {
       constructor() {
           this.name = 'mycustom';
           this.displayName = 'My Custom Mode';
           this.onComplete = null;
       }
       
       processGesture(gesture) {
           // Process the gesture and return result
           // gesture contains: direction, deltaX, deltaY, startX, startY, endX, endY
           return {
               position: selectedPosition,
               complete: true/false
           };
       }
       
       getState() {
           return {
               stage: 'ready',
               message: 'Your instruction message'
           };
       }
       
       reset() {
           // Reset any internal state
       }
       
       onCompletion(callback) {
           this.onComplete = callback;
       }
   }
   ```

2. Add the mode to `InputModeManager.modes` object:
   ```javascript
   this.modes = {
       clockface: new ClockFaceMode(),
       twoswipe: new TwoSwipeMode(),
       mycustom: new MyCustomMode()  // Add your mode here
   };
   ```

3. The mode will automatically be available through the InputModeManager

### Integration Example

Here's how to integrate the gesture input system in your page:

```html
<!-- Include the required JavaScript files -->
<script src="assets/js/gestureDetector.js"></script>
<script src="assets/js/inputModes.js"></script>

<script>
    // Initialize input mode manager
    const inputModeManager = new InputModeManager();
    inputModeManager.initialize();
    inputModeManager.loadSavedMode();
    
    // Set a specific mode
    inputModeManager.setMode('twoswipe');
    
    // Handle gesture completion
    inputModeManager.onCompletion((position) => {
        console.log(`Selected position: ${position} o'clock`);
        // Do something with the position
    });
    
    // Get current state for UI feedback
    const state = inputModeManager.getState();
    console.log(state.message); // Display instruction to user
</script>
```

## iOS Installation (Recommended)

For the best fullscreen experience on iPhone:

1. Open the app in **Safari**
2. Tap the **Share** button (square with arrow)
3. Select **"Add to Home Screen"**
4. Launch the app from your home screen icon

When launched from the home screen, the app runs in standalone mode with no browser UI!

## Running Locally

Serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Browser Compatibility

- **iOS Safari**: Full support with standalone mode
- **Android Chrome**: Full support
- **Desktop browsers**: Works but optimized for touch input

## Project Structure

```
Magic-Ideas/
├── assets/
│   ├── css/
│   │   └── base.css              # Base styling
│   └── js/
│       ├── gestureDetector.js    # Gesture detection (new modular system)
│       ├── inputModes.js         # Input modes (ClockFace, TwoSwipe)
│       ├── gestures.js           # Legacy gesture detection
│       ├── swipe.js              # Legacy swipe engine
│       └── storage.js            # LocalStorage utilities
├── tricks/
│   ├── swipe/                    # Swipe input trick
│   │   ├── settings.html
│   │   └── perform.html
│   └── hangman/                  # Hangman drawing
├── tools/
│   └── time-travel/              # Time travel utility
├── gesture-input-demo.html       # Interactive demo of gesture input modes
├── contained-swipe.html          # Contained swipe variant
├── index.html                    # Main landing page
└── README.md                     # This file
```

## License

This project is open source and available for personal and educational use.

## Credits

Inspired by iOS gesture-based interfaces and designed for magic tricks and interactive demonstrations.
