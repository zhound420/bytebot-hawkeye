export const COORDINATE_SYSTEM_CONFIG = {
  universalTeaching:
    (process.env.BYTEBOT_UNIVERSAL_TEACHING ?? 'true').toLowerCase() !== 'false',
  adaptiveCalibration:
    (process.env.BYTEBOT_ADAPTIVE_CALIBRATION ?? 'true').toLowerCase() !== 'false',
  zoomRefinement:
    (process.env.BYTEBOT_ZOOM_REFINEMENT ?? 'true').toLowerCase() !== 'false',
  coordinateMetrics:
    (process.env.BYTEBOT_COORDINATE_METRICS ?? 'true').toLowerCase() !== 'false',
};
