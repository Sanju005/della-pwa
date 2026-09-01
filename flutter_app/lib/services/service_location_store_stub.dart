// Fallback for platforms that are neither `dart:io` nor web. Unreachable in
// practice for a real Flutter build (native → service_location_store_io.dart,
// web → service_location_store_web.dart) — kept only so the conditional
// import always has a valid default branch.

Future<void> ensureLoaded() async {}

String? read(String key) => null;

void write(String key, String value) {}

void remove(String key) {}
