# Grid Overlay Testing Guide

## Overview
The coordinate grid overlay system has been implemented to improve AI coordinate detection accuracy by providing visual reference points on screenshots.

## Implementation Summary

### Files Created/Modified:
1. **NEW**: `packages/bytebotd/src/nut/grid-overlay.service.ts` - Main grid overlay service
2. **MODIFIED**: `packages/bytebotd/src/computer-use/computer-use.service.ts` - Integrated grid overlay
3. **MODIFIED**: `packages/bytebotd/src/computer-use/computer-use.module.ts` - Added service provider

## Configuration Options

### Environment Variables

#### Basic Grid Overlay
```bash
# Enable grid overlay (default grid: 100px, green, semi-transparent)
BYTEBOT_GRID_OVERLAY=true

# Disable grid overlay (default)
BYTEBOT_GRID_OVERLAY=false
```

#### Debug Mode (High Contrast)
```bash
# Enable debug mode with high contrast red grid
BYTEBOT_GRID_OVERLAY=true
BYTEBOT_GRID_DEBUG=true
```

### Grid Features

#### Standard Grid (BYTEBOT_GRID_OVERLAY=true):
- Grid lines every 100 pixels
- Semi-transparent green lines (40% opacity)
- Green coordinate labels (80% opacity)
- Shows X coordinates on top edge
- Shows Y coordinates on left edge
- Corner coordinates for reference

#### Debug Grid (BYTEBOT_GRID_DEBUG=true):
- Grid lines every 100 pixels
- High contrast red lines (80% opacity)
- Red coordinate labels (100% opacity)
- Thicker lines for visibility
- Larger font size

#### Subtle Grid (programmatic only):
- Grid lines every 50 pixels
- White lines (15% opacity)
- White labels (60% opacity)
- Smaller font size

## Testing the Implementation

### 1. Test Docker Environment
```bash
# Add to docker/.env file:
echo "BYTEBOT_GRID_OVERLAY=true" >> docker/.env

# Restart the container
docker-compose -f docker/docker-compose.yml restart bytebot-desktop
```

### 2. Test Development Environment
```bash
cd packages/bytebotd

# Enable grid overlay
export BYTEBOT_GRID_OVERLAY=true

# Run the service
npm run start:dev
```

### 3. Verify via API
```bash
# Take a screenshot and verify grid overlay is present
curl -X POST http://localhost:9990/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "screenshot"}' > screenshot_with_grid.json

# The response should contain base64 image with grid overlay
```

## Grid Overlay Features

### Coordinate Labels:
- **Origin (0,0)**: Top-left corner
- **X-axis labels**: Every 100px horizontally
- **Y-axis labels**: Every 100px vertically
- **Corner labels**: All four corners show coordinates

### Visual Elements:
- **Grid lines**: Semi-transparent overlay
- **Coordinate text**: Bold, positioned for readability
- **Error handling**: Falls back to original image on processing error

### Performance Considerations:
- Grid overlay is only applied when enabled
- Uses Sharp library for efficient image processing
- Minimal performance impact (~50-100ms per screenshot)

## Expected AI Benefits

1. **Precise Coordinate References**: AI can use grid lines to determine exact pixel positions
2. **Visual Calibration**: Grid provides scale reference for different screen resolutions
3. **Reduced Click Errors**: Visual guides help AI align clicks more accurately
4. **Debugging Aid**: Debug mode helps developers verify coordinate calculations

## Example Grid Layout (1920x1080 screen):

```
0,0    100    200    300  ...  1900  1920,0
100    +      +      +    ...   +      +
200    +      +      +    ...   +      +
300    +      +      +    ...   +      +
...    ...    ...    ...  ...  ...   ...
1000   +      +      +    ...   +      +
0,1080 +      +      +    ...   +   1920,1080
```

## Next Steps for Testing

1. Enable grid overlay in your environment
2. Create a test task that requires precise clicking
3. Compare click accuracy with and without grid overlay
4. Monitor logs for grid overlay processing messages
5. Test with different screen resolutions

## Troubleshooting

### Grid not appearing?
- Check environment variable: `echo $BYTEBOT_GRID_OVERLAY`
- Check service logs for grid overlay messages
- Verify Sharp library is working

### Performance issues?
- Use standard grid instead of debug mode
- Consider disabling for production unless needed
- Monitor memory usage during image processing

### Grid not aligned?
- Grid coordinates match screen pixels exactly
- Check screen DPI/scaling settings
- Verify screenshot resolution matches screen resolution