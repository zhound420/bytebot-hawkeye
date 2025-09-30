#include "macros.h"
#include "Mat.h"
#include "Size.h"

#ifndef __FF_CLAHE_H__
#define __FF_CLAHE_H__

class CLAHE : public Nan::ObjectWrap {
public:
  static Nan::Persistent<v8::FunctionTemplate> constructor;

  static const char* getClassName() { return "CLAHE"; }

  static NAN_MODULE_INIT(Init);
  static NAN_METHOD(New);
  static NAN_METHOD(Apply);
  static NAN_METHOD(SetClipLimit);
  static NAN_METHOD(GetClipLimit);
  static NAN_METHOD(SetTilesGridSize);
  static NAN_METHOD(GetTilesGridSize);
  static NAN_METHOD(CollectGarbage);

  static NAN_GETTER(ClipLimitGetter);
  static NAN_GETTER(TilesGridSizeGetter);

  cv::Ptr<cv::CLAHE> instance;
};

#endif
