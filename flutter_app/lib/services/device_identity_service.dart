import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';

/// A stable, app-specific device identifier used purely to decide whether
/// the backend has seen this device before for THIS account — never a
/// hardware serial/IMEI/ANDROID_ID (Android restricts/deprecates those for
/// exactly this kind of use, and iOS has no stable equivalent at all).
/// Generated once, stored in the platform keychain/keystore via
/// flutter_secure_storage, and reused on every launch. Reinstalling the app
/// or clearing app data produces a new one — which is intentional: it means
/// the device goes back to "unknown" and requires the Swiper PIN again,
/// the same as if it were physically a different device.
///
/// iOS Keychain items survive app deletion by default, and — depending on
/// accessibility class — can be included in an encrypted device backup and
/// restored onto a DIFFERENT physical device, which would let that new
/// device inherit the old one's device_id and its trust. `first_unlock_
/// this_device` explicitly excludes the item from backups/migration, so
/// device_id stays bound to this one physical device: a restore (or
/// reinstall) always lands on a fresh id, matching Android's actual
/// behavior (Keystore-backed values are removed on uninstall there).
class DeviceIdentityService {
  const DeviceIdentityService();

  static const _storage = FlutterSecureStorage(
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );
  static const _deviceIdKey = 'swiper_device_id';

  Future<String> getDeviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final generated = _generateId();
    await _storage.write(key: _deviceIdKey, value: generated);
    return generated;
  }

  String _generateId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    // Stamp as a UUIDv4-shaped string — not cryptographically meaningful
    // beyond being a large random value, just a conventional format.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  String get platform {
    if (kIsWeb) {
      return 'web';
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return 'other';
    }
  }

  /// Best-effort friendly label ("Samsung Galaxy S24", "iPhone 15") for a
  /// future Settings > Security > Your Devices list. Never used for the
  /// trust decision itself — only device_id is.
  Future<String> getDeviceName() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (kIsWeb) {
        final info = await deviceInfo.webBrowserInfo;
        return info.browserName.name;
      }
      switch (defaultTargetPlatform) {
        case TargetPlatform.android:
          final info = await deviceInfo.androidInfo;
          return '${info.manufacturer} ${info.model}'.trim();
        case TargetPlatform.iOS:
          final info = await deviceInfo.iosInfo;
          return info.utsname.machine;
        default:
          return 'Unknown device';
      }
    } catch (_) {
      return 'Unknown device';
    }
  }
}
