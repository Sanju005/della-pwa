import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

import 'browser_file_picker_types.dart';

/// Maximum long-edge pixel dimension for avatar/profile photos before
/// upload. Chosen from the real display sizes found across the app
/// (36-212px for avatars/portraits) -- 800px is generous headroom even for
/// the largest single portrait use, at a fraction of a typical original.
const int kAvatarMaxDimension = 800;

/// Maximum long-edge pixel dimension for work images, job-completion
/// photos, certificates, and review photos before upload. These are shown
/// larger than avatars in some gallery/fullscreen views (96-182px
/// thumbnails, occasionally larger), so they get more headroom than
/// avatars but still far below a typical 3000px+ original.
const int kMediumImageMaxDimension = 1280;

/// Resizes and re-compresses an already-picked PUBLIC image before upload,
/// so a large original doesn't get sent to Supabase untouched.
///
/// Deliberately NOT wired into the shared pickers themselves
/// (pickSingleBrowserFile / pickMultipleBrowserFiles / pickAndCropImage) --
/// several of those are also used by private/excluded upload paths
/// (identity documents, payment proofs, support documents, chat and Help
/// Centre attachments). Calling this explicitly only at approved call
/// sites, after the existing unchanged picker functions return their
/// result, means those excluded paths are completely unaffected regardless
/// of which shared picker they happen to use.
///
/// Never touches non-image files (PDFs, etc.) -- returns them unchanged.
/// Never upscales -- an image already at or under [maxDimension] on its
/// long edge is returned completely untouched, not re-encoded. Aspect
/// ratio is always preserved. EXIF orientation is handled by the
/// `image` package itself during decode (auto-applied since v3.0.3 of that
/// package; we're on 4.9.2), so no manual rotation step is needed here.
Future<PickedBrowserFile> optimizePublicImage(
  PickedBrowserFile file, {
  required int maxDimension,
}) async {
  if (!file.mimeType.startsWith('image/')) {
    return file;
  }

  final bytes = _decodeDataUrlBytes(file.dataUrl);
  if (bytes == null) {
    return file;
  }

  Uint8List? optimizedBytes;
  try {
    optimizedBytes = await compute(
      _resizeAndEncodeJpg,
      _ResizeRequest(bytes, maxDimension),
    );
  } catch (_) {
    // Fail open: if anything goes wrong (unsupported format such as HEIC,
    // a decode error, etc.) upload the original rather than block the
    // user or risk a corrupted file.
    return file;
  }

  if (optimizedBytes == null) {
    // Signals either "already within bounds" or "could not be decoded" --
    // either way, the original file is the right thing to upload.
    return file;
  }

  return PickedBrowserFile(
    name: _withJpgExtension(file.name),
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,${base64Encode(optimizedBytes)}',
  );
}

class _ResizeRequest {
  const _ResizeRequest(this.bytes, this.maxDimension);
  final Uint8List bytes;
  final int maxDimension;
}

/// Runs on a background isolate via [compute] so a large photo doesn't
/// freeze the UI while it's being resized. Must stay a top-level function
/// (not a closure) for compute() to be able to send it to that isolate.
/// Returns null when no re-encode is needed (already small enough) or the
/// bytes couldn't be decoded (e.g. an unsupported format like HEIC) --
/// both cases mean "use the original file as-is".
Uint8List? _resizeAndEncodeJpg(_ResizeRequest request) {
  img.Image? decoded;
  try {
    decoded = img.decodeImage(request.bytes);
  } catch (_) {
    return null;
  }
  if (decoded == null) {
    return null;
  }

  final longEdge = decoded.width > decoded.height
      ? decoded.width
      : decoded.height;
  if (longEdge <= request.maxDimension) {
    return null;
  }

  final resized = decoded.width >= decoded.height
      ? img.copyResize(decoded, width: request.maxDimension)
      : img.copyResize(decoded, height: request.maxDimension);

  return Uint8List.fromList(img.encodeJpg(resized, quality: 90));
}

Uint8List? _decodeDataUrlBytes(String dataUrl) {
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

String _withJpgExtension(String name) {
  final dotIndex = name.lastIndexOf('.');
  final base = dotIndex == -1 ? name : name.substring(0, dotIndex);
  return '$base.jpg';
}
