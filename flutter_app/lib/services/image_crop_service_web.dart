import 'browser_file_picker.dart';

/// Web has no native crop UI wired up here — fall back to the plain picker
/// so provider registration still works in a browser, just without cropping.
Future<PickedBrowserFile?> pickAndCropImageImpl({
  required String toolbarTitle,
  double? aspectRatioX,
  double? aspectRatioY,
}) {
  return pickSingleBrowserFile(accept: 'image/*');
}
