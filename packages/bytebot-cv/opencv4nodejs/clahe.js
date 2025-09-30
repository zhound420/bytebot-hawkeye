module.exports = function addClahePolyfills(cv) {
  const factory = cv?.imgproc?.createCLAHE;
  if (typeof factory !== 'function') {
    return;
  }

  if (typeof cv.createCLAHE !== 'function') {
    cv.createCLAHE = function createCLAHE(...args) {
      return factory.apply(cv.imgproc, args);
    };
  }

  if (cv.imgproc?.CLAHE && !cv.CLAHE) {
    cv.CLAHE = cv.imgproc.CLAHE;
  }

  if (!cv.xphoto) {
    cv.xphoto = {};
  }
  if (typeof cv.xphoto.createCLAHE !== 'function') {
    cv.xphoto.createCLAHE = function createCLAHE(...args) {
      return factory.apply(cv.imgproc, args);
    };
  }

  if (!cv.ximgproc) {
    cv.ximgproc = {};
  }
  if (typeof cv.ximgproc.createCLAHE !== 'function') {
    cv.ximgproc.createCLAHE = function createCLAHE(...args) {
      return factory.apply(cv.imgproc, args);
    };
  }
};
