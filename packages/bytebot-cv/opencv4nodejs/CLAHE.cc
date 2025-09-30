#include "opencv_modules.h"

#ifdef HAVE_OPENCV_IMGPROC

#include <algorithm>
#include <opencv2/imgproc.hpp>
#include <cmath>
#include <vector>

#include "CLAHE.h"
#include "Mat.h"
#include "Size.h"

Nan::Persistent<v8::FunctionTemplate> CLAHE::constructor;

namespace {
  cv::Size sanitizeSize(const cv::Size& size) {
    int width = std::max(1, size.width);
    int height = std::max(1, size.height);
    return cv::Size(width, height);
  }

  bool extractSize(v8::Local<v8::Value> value, cv::Size& out) {
    auto context = Nan::GetCurrentContext();

    if (value->IsArray()) {
      v8::Local<v8::Array> arr = v8::Local<v8::Array>::Cast(value);
      if (arr->Length() < 2) {
        return false;
      }
      double width = Nan::To<double>(Nan::Get(arr, 0).ToLocalChecked()).FromMaybe(out.width);
      double height = Nan::To<double>(Nan::Get(arr, 1).ToLocalChecked()).FromMaybe(out.height);
      out = sanitizeSize(cv::Size(static_cast<int>(std::round(width)), static_cast<int>(std::round(height))));
      return true;
    }

    if (value->IsObject()) {
      v8::Local<v8::Object> obj = value->ToObject(context).ToLocalChecked();

      if (Nan::Has(obj, Nan::New("width").ToLocalChecked()).FromMaybe(false) ||
          Nan::Has(obj, Nan::New("height").ToLocalChecked()).FromMaybe(false)) {
        double width = Nan::To<double>(Nan::Get(obj, Nan::New("width").ToLocalChecked()).ToLocalChecked()).FromMaybe(out.width);
        double height = Nan::To<double>(Nan::Get(obj, Nan::New("height").ToLocalChecked()).ToLocalChecked()).FromMaybe(out.height);
        out = sanitizeSize(cv::Size(static_cast<int>(std::round(width)), static_cast<int>(std::round(height))));
        return true;
      }

      if (Nan::Has(obj, Nan::New("tileGridSize").ToLocalChecked()).FromMaybe(false)) {
        return extractSize(Nan::Get(obj, Nan::New("tileGridSize").ToLocalChecked()).ToLocalChecked(), out);
      }
    }

    if (value->IsNumber()) {
      double len = Nan::To<double>(value).FromMaybe(8.0);
      int side = std::max(1, static_cast<int>(std::round(len)));
      out = cv::Size(side, side);
      return true;
    }

    return false;
  }

  bool parseClipLimit(v8::Local<v8::Value> value, double& clipLimit) {
    if (!value->IsUndefined() && !value->IsNull()) {
      if (!value->IsNumber()) {
        return false;
      }
      clipLimit = Nan::To<double>(value).FromMaybe(clipLimit);
    }
    return true;
  }
}

NAN_MODULE_INIT(CLAHE::Init) {
  v8::Local<v8::FunctionTemplate> ctor = Nan::New<v8::FunctionTemplate>(CLAHE::New);
  v8::Local<v8::ObjectTemplate> instanceTemplate = ctor->InstanceTemplate();

  constructor.Reset(ctor);
  instanceTemplate->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("CLAHE").ToLocalChecked());

  Nan::SetAccessor(instanceTemplate, Nan::New("clipLimit").ToLocalChecked(), ClipLimitGetter);
  Nan::SetAccessor(instanceTemplate, Nan::New("tilesGridSize").ToLocalChecked(), TilesGridSizeGetter);

  Nan::SetPrototypeMethod(ctor, "apply", CLAHE::Apply);
  Nan::SetPrototypeMethod(ctor, "setClipLimit", CLAHE::SetClipLimit);
  Nan::SetPrototypeMethod(ctor, "getClipLimit", CLAHE::GetClipLimit);
  Nan::SetPrototypeMethod(ctor, "setTilesGridSize", CLAHE::SetTilesGridSize);
  Nan::SetPrototypeMethod(ctor, "getTilesGridSize", CLAHE::GetTilesGridSize);
  Nan::SetPrototypeMethod(ctor, "collectGarbage", CLAHE::CollectGarbage);

  Nan::Set(target, Nan::New("CLAHE").ToLocalChecked(), Nan::GetFunction(ctor).ToLocalChecked());
}

NAN_METHOD(CLAHE::New) {
  FF::TryCatch tryCatch("CLAHE::New");
  FF_ASSERT_CONSTRUCT_CALL();

  double clipLimit = 40.0;
  cv::Size tiles = cv::Size(8, 8);

  if (info.Length() > 0 && info[0]->IsObject() && !info[0]->IsArray() && !info[0]->IsNumber()) {
    v8::Local<v8::Object> opts = info[0]->ToObject(Nan::GetCurrentContext()).ToLocalChecked();
    if (Nan::Has(opts, Nan::New("clipLimit").ToLocalChecked()).FromMaybe(false)) {
      clipLimit = Nan::To<double>(Nan::Get(opts, Nan::New("clipLimit").ToLocalChecked()).ToLocalChecked()).FromMaybe(clipLimit);
    }
    extractSize(opts, tiles);
  } else if (info.Length() > 0 && !parseClipLimit(info[0], clipLimit) && !extractSize(info[0], tiles)) {
    return tryCatch.throwError("Invalid arguments for CLAHE constructor");
  }

  if (info.Length() > 1 && !extractSize(info[1], tiles)) {
    return tryCatch.throwError("Unable to parse tileGridSize");
  }

  clipLimit = std::max(0.0, clipLimit);
  tiles = sanitizeSize(tiles);

  CLAHE* self = new CLAHE();
  self->instance = cv::createCLAHE(clipLimit, tiles);
  self->Wrap(info.Holder());
  info.GetReturnValue().Set(info.Holder());
}

NAN_METHOD(CLAHE::Apply) {
  FF::TryCatch tryCatch("CLAHE::apply");
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());

  cv::Mat src;
  if (Mat::Converter::arg(0, &src, info)) {
    return tryCatch.reThrow();
  }

  cv::Mat dst;
  bool hasDst = false;
  if (info.Length() > 1 && !info[1]->IsUndefined() && !info[1]->IsNull()) {
    if (Mat::Converter::arg(1, &dst, info)) {
      return tryCatch.reThrow();
    }
    hasDst = true;
  }

  if (hasDst) {
    self->instance->apply(src, dst);
    info.GetReturnValue().Set(Mat::Converter::wrap(dst));
  } else {
    cv::Mat result;
    self->instance->apply(src, result);
    info.GetReturnValue().Set(Mat::Converter::wrap(result));
  }
}

NAN_METHOD(CLAHE::SetClipLimit) {
  FF::TryCatch tryCatch("CLAHE::setClipLimit");
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());

  double clipLimit;
  if (FF::DoubleConverter::arg(0, &clipLimit, info)) {
    return tryCatch.reThrow();
  }

  self->instance->setClipLimit(std::max(0.0, clipLimit));
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(CLAHE::GetClipLimit) {
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());
  info.GetReturnValue().Set(Nan::New(self->instance->getClipLimit()));
}

NAN_METHOD(CLAHE::SetTilesGridSize) {
  FF::TryCatch tryCatch("CLAHE::setTilesGridSize");
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());

  cv::Size tiles = sanitizeSize(cv::Size(8, 8));
  if (!extractSize(info[0], tiles)) {
    return tryCatch.throwError("Unable to parse tilesGridSize");
  }

  self->instance->setTilesGridSize(sanitizeSize(tiles));
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(CLAHE::GetTilesGridSize) {
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());
  cv::Size tiles = self->instance->getTilesGridSize();
  info.GetReturnValue().Set(Size::Converter::wrap(cv::Size2d(tiles.width, tiles.height)));
}

NAN_METHOD(CLAHE::CollectGarbage) {
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());
  self->instance->collectGarbage();
  info.GetReturnValue().Set(info.This());
}

NAN_GETTER(CLAHE::ClipLimitGetter) {
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());
  info.GetReturnValue().Set(Nan::New(self->instance->getClipLimit()));
}

NAN_GETTER(CLAHE::TilesGridSizeGetter) {
  CLAHE* self = Nan::ObjectWrap::Unwrap<CLAHE>(info.This());
  cv::Size tiles = self->instance->getTilesGridSize();
  info.GetReturnValue().Set(Size::Converter::wrap(cv::Size2d(tiles.width, tiles.height)));
}

#endif
