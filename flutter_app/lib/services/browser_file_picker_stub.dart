import 'browser_file_picker_types.dart';

Future<PickedBrowserFile?> pickSingleBrowserFileImpl({
  String accept = 'image/*,application/pdf',
}) async {
  return null;
}

Future<List<PickedBrowserFile>> pickMultipleBrowserFilesImpl({
  String accept = 'image/*',
  int maxFiles = 4,
}) async {
  return const [];
}
