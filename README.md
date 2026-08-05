# Magic Ideas

A mobile-first collection of magic utilities, gesture experiments, and performance tools. **Swipe Input** is the primary covert-input utility.

## Swipe Input

Open [`tricks/swipe/settings.html`](./tricks/swipe/settings.html) to configure the trick, then enter Performance mode.

Performance mode turns the entire viewport into an invisible input surface. A swipe can start anywhere on the screen, including over an uploaded fake Home Screen background. There is no keypad. Two unlabeled bottom-corner numbers show the previous submitted value on the left and current input on the right; `—` means there is no value yet.

### Two-swipe clock (default)

The digits are arranged like a clock: **0 is at 12 o’clock**, 3 is at the right, 6 at the bottom, and 9 at the left.

The first swipe chooses an anchor. The second swipe repeats that direction or points toward a neighboring digit:

| First + second swipe | Digit |
|---|---:|
| ↑← / ↑↑ / ↑→ | 9 / 0 / 1 |
| →↑ / →→ / →↓ | 2 / 3 / 4 |
| ↓→ / ↓↓ / ↓← | 5 / 6 / 7 |
| ←↓ / ←← / ←↑ | 8 / 9 / 0 |

An opposite second swipe is ambiguous, so it becomes the first swipe of a new pair instead of entering a possibly incorrect digit. An unfinished pair resets after three seconds.

### Direct clock face

A single swipe selects the nearest of 12 clock sectors. The orientation is:

- Straight up → 12 o’clock → digit 0
- Right → 3 o’clock → digit 3
- Down → 6 o’clock → digit 6
- Left → 9 o’clock → digit 9

Clock positions 10 and 11 do not enter digits.

### Performance controls

- Double-tap → clear the current input
- Quick two-finger tap → submit immediately
- Two-finger downward swipe → exit to Settings
- Hold two fingers for about 750 ms → exit fallback
- Wait for the configured delay → auto-submit

Swipes are not counted as taps, so a fast two-swipe digit cannot accidentally trigger the double-tap clear command. Quick two-finger submit, two-finger downward exit, and two-finger hold-to-exit are also classified separately.

The optional **Practice Mode** setting adds a large current-input display at the center, with the previous value underneath. It is off by default; performance mode otherwise retains only the two small corner peeks.

### Clipboard and Shortcuts

Automatic clipboard handoff is enabled by default. The app updates the clipboard after each complete digit, while the swipe event still provides browser user activation. The submitted value therefore remains available to paste even when auto-submit happens later.

Clipboard access requires a secure context (HTTPS or localhost) and can still be denied by browser or device permissions. The settings toggle can disable automatic copying. An optional iOS Shortcut can also receive the submitted value as text.

### Wallpaper performance mode

Settings accepts an image or Home Screen screenshot. The original is stored in IndexedDB rather than inside the small localStorage settings record, avoiding the common mobile failure caused by large photo data URLs. While Settings is open, the app also prepares a size-limited instant copy so the wallpaper is present on the first painted frame of Performance mode instead of appearing after another full decode.

In Performance mode the image is applied to a fixed, full-viewport CSS background layer with `background-size: cover` and centered positioning. It is not rendered as an inline photo, and it cannot intercept gestures. If wallpaper mode is disabled or no valid image is available, this layer is solid black so the phone can appear off. For an exact fake Home Screen, upload a screenshot from the same device and orientation.

The Swipe Input pages request fullscreen web-app display, avoid the problematic `100dvh`/`-webkit-fill-available` combination, and extend the wallpaper layer to the reported physical screen height. On iPhone, open the site in Safari, choose **Share → Add to Home Screen**, then launch the saved icon. A normal or in-app browser view can only fill its webpage viewport; web code cannot remove that browser’s own top and bottom controls.

Some current iOS 26.5.x and iOS 27 beta releases have a [WebKit regression](https://bugs.webkit.org/show_bug.cgi?id=301994) that can reserve a system-owned strip below a Home Screen web app. That strip is outside the DOM, so no page element can draw into it. The root-canvas and physical-screen-height handling here cover code-side viewport gaps; an OS-owned strip ultimately requires Apple’s WebKit fix.

### Contained variant

[`contained-swipe.html`](./contained-swipe.html) provides the settings and performance surface in one page. It now uses the same gesture detector, clock math, clipboard behavior, configuration, and wallpaper storage as the main Swipe Input pages.

## Gesture demo

Open [`gesture-input-demo.html`](./gesture-input-demo.html) to test both input modes. The demo limits detection to its visible swipe box; the actual performance pages attach the same detector to the full viewport.

## Swipe architecture

| File | Responsibility |
|---|---|
| `assets/js/clockInput.js` | Clock orientation, digit mapping, and the two-swipe state machine |
| `assets/js/gestureDetector.js` | Pointer/touch detection and distinct swipe, tap, two-finger tap, hold, and two-finger swipe gestures |
| `assets/js/gestures.js` | Small compatibility facade used by the performance engine |
| `assets/js/swipe.js` | Numeric buffer, clipboard syncing, auto-submit, Shortcut routing, and lifecycle |
| `assets/js/storage.js` | Local settings plus IndexedDB-backed wallpaper storage |
| `assets/js/inputModes.js` | Demo-oriented mode wrappers and mode manager |

Both Swipe Input variants use this shared implementation; there is no separate embedded gesture engine to keep in sync.

## Other tools

- **Dummy Home Screen PWA** (`pwa-home-screen/`): standalone fake Home Screen experiment
- **iPhone Mirage** (`tricks/iphone-mirage/`): icon-based covert input experiment
- **Contacts Thought** (`tricks/contacts-thought/`): contacts-themed trick
- **Card Stack Trainer** (`tools/card-stack-trainer/`): memorized-deck drills and progress tracking
- **Date Quizzer** (`tools/date-quizzer/`): day/date practice
- **Time Travel** (`tools/time-travel/`): time-based utility

## Run locally

Serve the repository instead of opening files directly so clipboard and storage behavior match deployment more closely:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/tricks/swipe/settings.html`.

Run the clock and two-swipe regression tests with:

```bash
node --test tests/swipe-input.test.js
```

## License

This project is available for personal and educational use.
