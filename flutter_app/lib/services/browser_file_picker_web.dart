import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'browser_file_picker_types.dart';

Future<PickedBrowserFile?> pickSingleBrowserFileImpl({
  String accept = 'image/*,application/pdf',
}) async {
  final files = await _pickFiles(accept: accept, multiple: false);
  if (files.isEmpty) {
    return null;
  }
  return files.first;
}

Future<List<PickedBrowserFile>> pickMultipleBrowserFilesImpl({
  String accept = 'image/*',
  int maxFiles = 4,
}) async {
  final files = await _pickFiles(accept: accept, multiple: true);
  if (files.length <= maxFiles) {
    return files;
  }
  return files.take(maxFiles).toList(growable: false);
}

Future<List<PickedBrowserFile>> _pickFiles({
  required String accept,
  required bool multiple,
}) {
  final completer = Completer<List<PickedBrowserFile>>();
  final input = web.HTMLInputElement()
    ..type = 'file'
    ..accept = accept
    ..multiple = multiple;

  late final JSFunction changeHandler;
  late final JSFunction cancelHandler;

  void cleanUp() {
    input.removeEventListener('change', changeHandler);
    input.removeEventListener('cancel', cancelHandler);
  }

  changeHandler = ((web.Event _) async {
    final selected = input.files;
    if (selected == null || selected.length == 0) {
      cleanUp();
      if (!completer.isCompleted) {
        completer.complete(const []);
      }
      return;
    }

    final files = <PickedBrowserFile>[];
    for (var index = 0; index < selected.length; index++) {
      final file = selected.item(index);
      if (file == null) {
        continue;
      }

      final dataUrl = await _readAsDataUrl(file);
      files.add(
        PickedBrowserFile(
          name: file.name,
          mimeType: file.type,
          dataUrl: dataUrl,
        ),
      );
    }

    cleanUp();
    if (!completer.isCompleted) {
      completer.complete(files);
    }
  }).toJS;

  cancelHandler = ((web.Event _) {
    cleanUp();
    if (!completer.isCompleted) {
      completer.complete(const []);
    }
  }).toJS;

  input.addEventListener('change', changeHandler);
  input.addEventListener('cancel', cancelHandler);
  input.click();

  return completer.future;
}

Future<String> _readAsDataUrl(web.File file) {
  final completer = Completer<String>();
  final reader = web.FileReader();

  reader.addEventListener(
    'load',
    ((web.Event _) {
      final result = reader.result;
      if (result == null) {
        if (!completer.isCompleted) {
          completer.complete('');
        }
        return;
      }

      if (!completer.isCompleted) {
        completer.complete(result.toString());
      }
    }).toJS,
  );

  reader.addEventListener(
    'error',
    ((web.Event _) {
      if (!completer.isCompleted) {
        completer.completeError(Exception('Unable to read selected file.'));
      }
    }).toJS,
  );

  reader.readAsDataURL(file);
  return completer.future;
}
