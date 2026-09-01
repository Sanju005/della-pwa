import 'browser_file_picker_types.dart';
import 'image_crop_service_stub.dart'
    if (dart.library.io) 'image_crop_service_io.dart'
    if (dart.library.js_interop) 'image_crop_service_web.dart';

/// Picks a single image and, on native platforms, lets the user crop it
/// before returning it. Pass both [aspectRatioX] and [aspectRatioY] to lock
/// the crop to a fixed ratio (e.g. 2:1.5 for service photos); omit both for
/// free-form cropping (e.g. a profile photo).
Future<PickedBrowserFile?> pickAndCropImage({
  required String toolbarTitle,
  double? aspectRatioX,
  double? aspectRatioY,
}) {
  return pickAndCropImageImpl(
    toolbarTitle: toolbarTitle,
    aspectRatioX: aspectRatioX,
    aspectRatioY: aspectRatioY,
  );
}
