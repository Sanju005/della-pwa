import 'dart:async';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

// Single-file store — this store only ever has one key in practice, so a
// per-key filename isn't worth the extra complexity. `read`/`write`/`remove`
// keep the `key` parameter only to match the shared io/web/stub interface.

String? _cache;
Future<File>? _fileFuture;

Future<File> _resolveFile() {
  return _fileFuture ??= getApplicationDocumentsDirectory().then(
    (dir) => File('${dir.path}/service_location_store.json'),
  );
}

/// Primes the in-memory cache from disk. Cheap to call repeatedly — only
/// does real I/O once per app run. The synchronous [read] below can only
/// ever reflect whatever has been primed so far, so callers that need the
/// value recovered after a cold start should await this first (see
/// `ServiceLocationStore.loadAsync`).
Future<void> ensureLoaded() async {
  if (_cache != null) {
    return;
  }
  try {
    final file = await _resolveFile();
    if (await file.exists()) {
      _cache = await file.readAsString();
    }
  } catch (_) {
    // Ignore — the location selection just stays unset.
  }
}

String? read(String key) => _cache;

void write(String key, String value) {
  _cache = value;
  unawaited(_writeToDisk(value));
}

Future<void> _writeToDisk(String value) async {
  try {
    final file = await _resolveFile();
    await file.writeAsString(value);
  } catch (_) {
    // Ignore — the in-memory cache still reflects the latest value for the
    // rest of this app run.
  }
}

void remove(String key) {
  _cache = null;
  unawaited(_removeFromDisk());
}

Future<void> _removeFromDisk() async {
  try {
    final file = await _resolveFile();
    if (await file.exists()) {
      await file.delete();
    }
  } catch (_) {
    // Ignore.
  }
}
