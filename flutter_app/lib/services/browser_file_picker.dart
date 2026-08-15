import 'browser_file_picker_stub.dart'
    if (dart.library.js_interop) 'browser_file_picker_web.dart';
import 'browser_file_picker_types.dart';

Future<PickedBrowserFile?> pickSingleBrowserFile({
  String accept = 'image/*,application/pdf',
}) {
  return pickSingleBrowserFileImpl(accept: accept);
}

Future<List<PickedBrowserFile>> pickMultipleBrowserFiles({
  String accept = 'image/*',
  int maxFiles = 4,
}) {
  return pickMultipleBrowserFilesImpl(accept: accept, maxFiles: maxFiles);
}
