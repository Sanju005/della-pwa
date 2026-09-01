import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:path_provider/path_provider.dart';

import '../theme/app_colors.dart';
import 'browser_file_picker.dart';

Future<PickedBrowserFile?> pickAndCropImageImpl({
  required String toolbarTitle,
  double? aspectRatioX,
  double? aspectRatioY,
}) async {
  final picked = await pickSingleBrowserFile(accept: 'image/*');
  if (picked == null) {
    return null;
  }

  final bytes = _decodeDataUrl(picked.dataUrl);
  if (bytes == null) {
    return picked;
  }

  final tempDir = await getTemporaryDirectory();
  final sourceFile = File(
    '${tempDir.path}/reg_crop_source_${DateTime.now().microsecondsSinceEpoch}.jpg',
  );
  await sourceFile.writeAsBytes(bytes);

  final aspectRatio = (aspectRatioX != null && aspectRatioY != null)
      ? CropAspectRatio(ratioX: aspectRatioX, ratioY: aspectRatioY)
      : null;

  CroppedFile? cropped;
  try {
    cropped = await ImageCropper().cropImage(
      sourcePath: sourceFile.path,
      aspectRatio: aspectRatio,
      compressFormat: ImageCompressFormat.jpg,
      compressQuality: 90,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: toolbarTitle,
          toolbarColor: AppColors.primary,
          toolbarWidgetColor: Colors.white,
          activeControlsWidgetColor: AppColors.primary,
          lockAspectRatio: aspectRatio != null,
        ),
        IOSUiSettings(
          title: toolbarTitle,
          aspectRatioLockEnabled: aspectRatio != null,
        ),
      ],
    );
  } finally {
    unawaited(sourceFile.delete().catchError((_) => sourceFile));
  }

  if (cropped == null) {
    return null;
  }

  final croppedBytes = await cropped.readAsBytes();
  return PickedBrowserFile(
    name: picked.name,
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,${base64Encode(croppedBytes)}',
  );
}

List<int>? _decodeDataUrl(String dataUrl) {
  final commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex == -1) {
    return null;
  }
  try {
    return base64Decode(dataUrl.substring(commaIndex + 1));
  } catch (_) {
    return null;
  }
}
