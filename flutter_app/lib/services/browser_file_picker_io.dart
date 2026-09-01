import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:image_picker/image_picker.dart';

import '../core/app_navigator.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import 'browser_file_picker_types.dart';

final ImagePicker _imagePicker = ImagePicker();

Future<PickedBrowserFile?> pickSingleBrowserFileImpl({
  String accept = 'image/*,application/pdf',
}) async {
  if (_isImageOnly(accept)) {
    final source = await _promptImageSource();
    if (source == null) {
      return null;
    }
    if (source == ImageSource.camera) {
      return _captureFromCamera();
    }
  }

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
  if (_isImageOnly(accept)) {
    final source = await _promptImageSource();
    if (source == null) {
      return const [];
    }
    if (source == ImageSource.camera) {
      final file = await _captureFromCamera();
      return file == null ? const [] : [file];
    }
  }

  return _pickFiles(accept: accept, allowMultiple: true, maxFiles: maxFiles);
}

/// Only image pickers get a camera option — anything that also accepts
/// documents (e.g. PDFs) keeps going straight to the system file picker,
/// since "take a photo" isn't a sensible substitute there.
bool _isImageOnly(String accept) {
  final normalized = accept.toLowerCase();
  return normalized.contains('image/*') && !normalized.contains('pdf');
}

/// Asks the user whether to take a new photo or choose an existing one,
/// via the app's root navigator so this low-level service doesn't need a
/// [BuildContext] threaded through every call site. Returns null if there's
/// no mounted navigator yet or the sheet is dismissed without a choice.
Future<ImageSource?> _promptImageSource() async {
  final context = rootNavigatorContext;
  if (context == null) {
    return null;
  }

  return showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.photo_camera_outlined,
                  color: AppColors.primary,
                ),
                title: const Text('Take Photo'),
                onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(
                  Icons.photo_library_outlined,
                  color: AppColors.primary,
                ),
                title: const Text('Choose from Gallery'),
                onTap: () =>
                    Navigator.of(sheetContext).pop(ImageSource.gallery),
              ),
            ],
          ),
        ),
      );
    },
  );
}

Future<PickedBrowserFile?> _captureFromCamera() async {
  try {
    final photo = await _imagePicker.pickImage(
      source: ImageSource.camera,
      imageQuality: 90,
    );
    if (photo == null) {
      return null;
    }

    final bytes = await photo.readAsBytes();
    final mimeType = _resolveMimeType(name: photo.name, accept: 'image/*');
    return PickedBrowserFile(
      name: photo.name,
      mimeType: mimeType,
      dataUrl: 'data:$mimeType;base64,${base64Encode(bytes)}',
    );
  } catch (error) {
    // Picking previously failed completely silently on some devices (e.g. a
    // stale install missing the CAMERA permission, or the OS denying it) —
    // surface something so it's obvious the tap did fail, not just do
    // nothing.
    _showPickerError(
      error is PlatformException
          ? (error.message?.trim().isNotEmpty == true
                ? error.message!
                : 'Unable to open the camera.')
          : 'Unable to open the camera.',
    );
    return null;
  }
}

void _showPickerError(String message) {
  final context = rootNavigatorContext;
  if (context == null) {
    return;
  }
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

Future<List<PickedBrowserFile>> _pickFiles({
  required String accept,
  required bool allowMultiple,
  required int maxFiles,
}) async {
  final normalized = accept.toLowerCase();
  final allowedExtensions = _allowedExtensionsForAccept(normalized);
  // file_picker throws ArgumentError if allowedExtensions is provided
  // together with any FileType other than FileType.custom — so whenever we
  // have an extension filter, the type must be forced to custom.
  final type = allowedExtensions == null ? FileType.any : FileType.custom;

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

  final extension = name.contains('.')
      ? name.split('.').last.toLowerCase()
      : '';
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
