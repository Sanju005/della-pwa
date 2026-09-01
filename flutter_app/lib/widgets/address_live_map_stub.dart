import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

/// Native (Android/iOS) live map preview for a saved address.
///
/// There's no Google Maps API key configured for native builds, so this
/// mirrors the free, key-less approach already used elsewhere in the app
/// (see service_radius_map.dart): OpenStreetMap tiles via flutter_map, with
/// the address text resolved to coordinates through Nominatim's free
/// geocoding search when a lat/lng isn't already known.
///
/// When [interactive] is true, the pin stays fixed at the center of the
/// widget and the map itself pans underneath it (the same UX Grab/Google
/// Maps use for "drag to fine-tune pin") — [onLocationSelected] reports the
/// resulting coordinates so the caller can persist an exact, user-confirmed
/// location alongside the free-text address.
class AddressLiveMap extends StatefulWidget {
  const AddressLiveMap({
    super.key,
    required this.address,
    this.latitude,
    this.longitude,
    this.height = 180,
    this.interactive = false,
    this.onLocationSelected,
  });

  final String address;
  final double? latitude;
  final double? longitude;
  final double height;
  final bool interactive;
  final void Function(double latitude, double longitude)? onLocationSelected;

  @override
  State<AddressLiveMap> createState() => _AddressLiveMapState();
}

class _AddressLiveMapState extends State<AddressLiveMap> {
  static final Map<String, LatLng> _geocodeCache = {};

  final _mapController = MapController();
  Timer? _debounce;
  Timer? _dragReportDebounce;
  String _lastLookedUp = '';
  bool _loading = false;
  bool _notFound = false;
  LatLng? _resolved;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(covariant AddressLiveMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.address != widget.address ||
        oldWidget.latitude != widget.latitude ||
        oldWidget.longitude != widget.longitude) {
      _sync();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _dragReportDebounce?.cancel();
    super.dispose();
  }

  void _sync() {
    if (widget.latitude != null && widget.longitude != null) {
      _debounce?.cancel();
      _applyResolved(
        LatLng(widget.latitude!, widget.longitude!),
        report: false,
      );
      return;
    }

    final trimmed = widget.address.trim();
    _debounce?.cancel();

    if (trimmed.length < 6) {
      setState(() {
        _resolved = null;
        _notFound = false;
        _loading = false;
      });
      return;
    }

    final cached = _geocodeCache[trimmed.toLowerCase()];
    if (cached != null) {
      _applyResolved(cached, report: true);
      return;
    }

    setState(() => _loading = true);
    _debounce = Timer(const Duration(milliseconds: 700), () {
      unawaited(_geocode(trimmed));
    });
  }

  void _applyResolved(LatLng point, {required bool report}) {
    setState(() {
      _resolved = point;
      _notFound = false;
      _loading = false;
    });
    if (widget.interactive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        _mapController.move(point, 17);
      });
    }
    if (report) {
      widget.onLocationSelected?.call(point.latitude, point.longitude);
    }
  }

  Future<void> _geocode(String address) async {
    _lastLookedUp = address;
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'format': 'json',
        'limit': '1',
        'q': address,
      });
      final response = await http
          .get(
            uri,
            headers: const {
              'User-Agent': 'DellaSwiperApp/1.0 (support@myswiper.my)',
            },
          )
          .timeout(const Duration(seconds: 8));

      if (!mounted || _lastLookedUp != address) {
        return;
      }

      if (response.statusCode != 200) {
        setState(() {
          _loading = false;
          _notFound = true;
        });
        return;
      }

      final results = jsonDecode(response.body) as List<dynamic>;
      if (results.isEmpty) {
        setState(() {
          _loading = false;
          _notFound = true;
        });
        return;
      }

      final match = results.first as Map<String, dynamic>;
      final lat = double.tryParse(match['lat']?.toString() ?? '');
      final lon = double.tryParse(match['lon']?.toString() ?? '');
      if (lat == null || lon == null) {
        setState(() {
          _loading = false;
          _notFound = true;
        });
        return;
      }

      final point = LatLng(lat, lon);
      _geocodeCache[address.toLowerCase()] = point;
      _applyResolved(point, report: true);
    } catch (_) {
      if (!mounted || _lastLookedUp != address) {
        return;
      }
      setState(() {
        _loading = false;
        _notFound = true;
      });
    }
  }

  void _onMapPositionChanged(MapCamera camera, bool hasGesture) {
    if (!hasGesture) {
      return;
    }
    _dragReportDebounce?.cancel();
    final center = camera.center;
    _dragReportDebounce = Timer(const Duration(milliseconds: 250), () {
      widget.onLocationSelected?.call(center.latitude, center.longitude);
    });
  }

  @override
  Widget build(BuildContext context) {
    final resolved = _resolved;

    if (resolved == null) {
      return SizedBox(
        height: widget.height,
        child: Center(
          child: _loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4),
                )
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    _notFound
                        ? "Couldn't locate this address yet — check the spelling or add more detail."
                        : 'Type an address to see it on the map.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF7B728A),
                    ),
                  ),
                ),
        ),
      );
    }

    final map = FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: resolved,
        initialZoom: 17,
        interactionOptions: InteractionOptions(
          flags: widget.interactive
              ? InteractiveFlag.drag |
                    InteractiveFlag.pinchZoom |
                    InteractiveFlag.doubleTapZoom
              : InteractiveFlag.none,
        ),
        onPositionChanged: widget.interactive ? _onMapPositionChanged : null,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'my.myswiper.app',
        ),
        if (!widget.interactive)
          MarkerLayer(
            markers: [
              Marker(
                point: resolved,
                width: 32,
                height: 32,
                child: const Icon(
                  Icons.location_on_rounded,
                  color: Color(0xFF684AB3),
                  size: 32,
                ),
              ),
            ],
          ),
      ],
    );

    if (!widget.interactive) {
      return SizedBox(
        height: widget.height,
        child: IgnorePointer(child: map),
      );
    }

    return SizedBox(
      height: widget.height,
      child: Stack(
        alignment: Alignment.center,
        children: [
          map,
          const Padding(
            padding: EdgeInsets.only(bottom: 28),
            child: Icon(
              Icons.location_on_rounded,
              color: Color(0xFF684AB3),
              size: 36,
            ),
          ),
        ],
      ),
    );
  }
}
