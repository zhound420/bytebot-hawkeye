# Smart Focus System for ByteBot

## Overview
The Smart Focus System improves desktop automation accuracy by progressively narrowing attention, rather than guessing absolute coordinates in one step.

## How It Works

### Phase 1: Region Identification
- Split the screen into a 3×3 grid of named regions.
- Ask the model which region holds the target using a coarse (≈200px) overlay.
- Respond with the region only (for example, `middle-center`).

### Phase 2: Focused Capture
- Capture just the identified region.
- Overlay a fine grid (25–50px) and enhance contrast/sharpness.
- Global coordinates are visible in the focused view.

### Phase 3: Precise Click
- Ask the model for the exact coordinates using the focused grid.
- Coordinates are already global; trigger the click immediately.

## Configuration

```bash
# Enable or disable Smart Focus (default: true)
export BYTEBOT_SMART_FOCUS=true

# Grid sizes
export BYTEBOT_OVERVIEW_GRID=200   # Coarse grid for the overview screenshot
export BYTEBOT_REGION_GRID=50      # Standard region grid
export BYTEBOT_FOCUSED_GRID=25     # Fine grid for close-ups

# Binary search depth (4 iterations ≈ 120px window)
export BYTEBOT_SEARCH_DEPTH=4

# Screenshot caching
export BYTEBOT_CACHE_SCREENSHOTS=true
export BYTEBOT_CACHE_TTL=100       # Cache duration in milliseconds

# Smart click success tolerance (pixels)
export BYTEBOT_SMART_CLICK_SUCCESS_RADIUS=12
```

Increase `BYTEBOT_SMART_CLICK_SUCCESS_RADIUS` if your hardware or VNC stream has
more drift, or decrease it to demand tighter clustering before a smart click is
considered successful. The daemon compares the cursor position after the click
against the final target point using this radius.

## Expected Accuracy Improvements

| Method        | Accuracy | Notes                              |
|---------------|----------|------------------------------------|
| Baseline      | ~15%     | Direct coordinate guesses          |
| Grid Only     | ~25%     | Visual grid aids manual estimates  |
| Smart Focus   | ~55%     | Two-stage focus with fine grid     |
| Binary Search | ~65%     | Iterative halving for precision    |
| Combined      | ~70%     | Focus first, fall back to binary   |

## Performance Impact

- Smart Focus: approximately +200 ms (two extra screenshots).
- Binary Search: approximately +400 ms (four screenshot iterations).
- Caching limits redundant captures, keeping latency acceptable.
- Still faster and more reliable than manual positioning.
