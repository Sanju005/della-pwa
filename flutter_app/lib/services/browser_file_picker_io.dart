import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';

import 'browser_file_picker_types.dart';

Future<PickedBrowserFile?> pickSingleBrowserFileImpl({
  String accept = 'image/*,application/pdf',
}) async {
  final files = await _pickFiles(
    accept: accept,
    allowMultiple: false,
    maxFiles: 1,
  );
  if (files.isEmpty) {
    return null;
  }
  return files.first;
}

Future<List<PickedBrowserFile>> pickMultipleBrowserFilesImpl({
  String accept = 'image/*',
  int maxFiles = 4,
}) async {
  return _pickFiles(
    accept: accept,
    allowMultiple: true,
    maxFiles: maxFiles,
  );
}

Future<List<PickedBrowserFile>> _pickFiles({
  required String accept,
  required bool allowMultiple,
  required int maxFiles,
}) async {
  final normalized = accept.toLowerCase();
  final type = _fileTypeForAccept(normalized);
  final allowedExtensions = _allowedExtensionsForAccept(normalized);

  final result = await FilePicker.platform.pickFiles(
    allowMultiple: allowMultiple,
    withData: true,
    type: type,
    allowedExtensions: allowedExtensions,
  );

  if (result == null || result.files.isEmpty) {
    return const [];
  }

  final picked = <PickedBrowserFile>[];
  for (final file in result.files.take(maxFiles)) {
    final bytes = file.bytes ?? await _readBytesFromPath(file.path);
    if (bytes == null || bytes.isEmpty) {
      continue;
    }

    final mimeType = _resolveMimeType(
      name: file.name,
      platformMimeType: file.extension == null ? null : null,
      accept: normalized,
    );

    picked.add(
      PickedBrowserFile(
        name: file.name,
        mimeType: mimeType,
        dataUrl: 'data:$mimeType;base64,${base64Encode(bytes)}',
      ),
    );
  }

  return picked;
}

Future<List<int>?> _readBytesFromPath(String? path) async {
  if (path == null || path.isEmpty) {
    return null;
  }
  final file = File(path);
  if (!await file.exists()) {
    return null;
  }
  return file.readAsBytes();
}

FileType _fileTypeForAccept(String accept) {
  if (accept.contains('image/*')) {
    return FileType.image;
  }
  if (accept.contains('pdf')) {
    return FileType.custom;
  }
  return FileType.any;
}

List<String>? _allowedExtensionsForAccept(String accept) {
  if (accept.contains('pdf') && !accept.contains('image/*')) {
    return const ['pdf'];
  }
  if (accept.contains('image/*') && !accept.contains('pdf')) {
    return const ['jpg', 'jpeg', 'png', 'webp', 'heic'];
  }
  if (accept.contains('image/*') && accept.contains('pdf')) {
    return const ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'];
  }
  return null;
}

String _resolveMimeType({
  required String name,
  required String accept,
  String? platformMimeType,
}) {
  if (platformMimeType != null && platformMimeType.trim().isNotEmpty) {
    return platformMimeType.trim();
  }

  final extension = name.contains('.') ? name.split('.').last.toLowerCase() : '';
  return switch (extension) {
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'heic' => 'image/heic',
    'pdf' => 'application/pdf',
    _ when accept.contains('image/*') => 'image/jpeg',
    _ when accept.contains('pdf') => 'application/pdf',
    _ => 'application/octet-stream',
  };
}
