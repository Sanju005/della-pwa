import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../theme/app_colors.dart';

/// Shows a provider's service location with a circle that grows/shrinks live
/// as [radiusKm] changes. Uses OpenStreetMap tiles — no API key required.
class ServiceRadiusMap extends StatefulWidget {
  const ServiceRadiusMap({
    super.key,
    required this.center,
    required this.radiusKm,
    this.height = 220,
  });

  final LatLng center;
  final double radiusKm;
  final double height;

  @override
  State<ServiceRadiusMap> createState() => _ServiceRadiusMapState();
}

class _ServiceRadiusMapState extends State<ServiceRadiusMap> {
  final _mapController = MapController();
  static const _distance = Distance();

  @override
  void didUpdateWidget(covariant ServiceRadiusMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.center != widget.center ||
        oldWidget.radiusKm != widget.radiusKm) {
      _fitToRadius();
    }
  }

  // Fits the camera so the whole radius circle is always visible in the map
  // card — rather than a fixed radius-to-zoom lookup, which left the circle
  // clipped or awkwardly small at some radius values.
  void _fitToRadius() {
    final metres = widget.radiusKm * 1000;
    final north = _distance.offset(widget.center, metres, 0);
    final south = _distance.offset(widget.center, metres, 180);
    final east = _distance.offset(widget.center, metres, 90);
    final west = _distance.offset(widget.center, metres, 270);

    _mapController.fitCamera(
      CameraFit.coordinates(
        coordinates: [north, south, east, west],
        padding: const EdgeInsets.all(24),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: widget.height,
        child: FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: widget.center,
            initialZoom: 12,
            onMapReady: _fitToRadius,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'my.myswiper.app',
            ),
            CircleLayer(
              circles: [
                CircleMarker(
                  point: widget.center,
                  radius: widget.radiusKm * 1000,
                  useRadiusInMeter: true,
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderColor: AppColors.primary,
                  borderStrokeWidth: 2,
                ),
              ],
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: widget.center,
                  width: 32,
                  height: 32,
                  child: const Icon(
                    Icons.location_on_rounded,
                    color: AppColors.primary,
                    size: 32,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
