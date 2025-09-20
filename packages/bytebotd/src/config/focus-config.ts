export const FOCUS_CONFIG = {
  // Enable/disable focus system
  ENABLE_SMART_FOCUS: process.env.BYTEBOT_SMART_FOCUS !== 'false',

  // Grid sizes for different zoom levels
  OVERVIEW_GRID_SIZE: parseInt(process.env.BYTEBOT_OVERVIEW_GRID || '200', 10),
  REGION_GRID_SIZE: parseInt(process.env.BYTEBOT_REGION_GRID || '50', 10),
  FOCUSED_GRID_SIZE: parseInt(process.env.BYTEBOT_FOCUSED_GRID || '25', 10),
  REGION_ZOOM_LEVEL: parseFloat(process.env.BYTEBOT_REGION_ZOOM || '1.5'),
  CUSTOM_REGION_ZOOM_LEVEL: parseFloat(
    process.env.BYTEBOT_CUSTOM_REGION_ZOOM || '2.0',
  ),
  GRID_ENABLED: process.env.BYTEBOT_GRID_OVERLAY !== 'false',
  GRID_DEBUG: process.env.BYTEBOT_GRID_DEBUG === 'true',

  // Binary search iterations
  BINARY_SEARCH_DEPTH: parseInt(process.env.BYTEBOT_SEARCH_DEPTH || '4', 10),

  // Performance settings
  CACHE_SCREENSHOTS: process.env.BYTEBOT_CACHE_SCREENSHOTS !== 'false',
  CACHE_TTL_MS: parseInt(process.env.BYTEBOT_CACHE_TTL || '100', 10),

  // Enhancement settings
  AUTO_ENHANCE: process.env.BYTEBOT_AUTO_ENHANCE === 'true',
  SHARPEN_AMOUNT: parseInt(process.env.BYTEBOT_SHARPEN || '1', 10),
};
