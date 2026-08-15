import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../models/provider_summary.dart';
import 'service_location_store.dart';

class ProviderCatalogResult {
  const ProviderCatalogResult({
    required this.service,
    required this.serviceLabel,
    required this.listings,
    required this.errorMessage,
  });

  final String? service;
  final String serviceLabel;
  final List<ProviderSummary> listings;
  final String? errorMessage;

  factory ProviderCatalogResult.fromJson(Map<String, dynamic> json) {
    final listings =
        (json['listings'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map(
              (item) => item.map(
                (key, value) => MapEntry(key.toString(), value),
              ),
            )
            .map(ProviderSummary.fromProviderCatalogJson)
            .toList();

    return ProviderCatalogResult(
      service: json['service'] as String?,
      serviceLabel: json['serviceLabel'] as String? ?? 'All Providers',
      listings: listings,
      errorMessage: json['errorMessage'] as String?,
    );
  }
}

class ProviderMarketplaceService {
  const ProviderMarketplaceService();

  Future<ProviderCatalogResult> fetchCatalog({
    String? service,
    ServiceLocationSelection? locationSelection,
  }) async {
    final uri = Uri.parse('${AppConfig.appBaseUrl}/api/providers').replace(
      queryParameters: {
        if (service != null && service.trim().isNotEmpty)
          'service': service.trim().toLowerCase(),
      },
    );

    final headers = <String, String>{'Accept': 'application/json'};
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken != null && accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    try {
      final response = await http.get(uri, headers: headers);
      final body = _decodeJson(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body is Map<String, dynamic>) {
        final catalog = ProviderCatalogResult.fromJson(body);
        return ProviderCatalogResult(
          service: catalog.service,
          serviceLabel: catalog.serviceLabel,
          listings: _applyLocationFilter(
            catalog.listings,
            locationSelection ?? ServiceLocationStore.load(),
          ),
          errorMessage: catalog.errorMessage,
        );
      }

      if (kDebugMode) {
        debugPrint('Provider catalog request failed: ${response.statusCode}');
        debugPrint(response.body);
      }

      throw Exception(_readError(body, response.statusCode));
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Provider catalog load error: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
      rethrow;
    }
  }

  Future<List<ProviderSummary>> fetchVisibleProviders({
    String? service,
    ServiceLocationSelection? locationSelection,
  }) async {
    final catalog = await fetchCatalog(
      service: service,
      locationSelection: locationSelection,
    );
    return catalog.listings;
  }

  List<ProviderSummary> _applyLocationFilter(
    List<ProviderSummary> listings,
    ServiceLocationSelection? selection,
  ) {
    if (selection == null) {
      return listings;
    }

    final tokens = selection.searchTokens;
    if (tokens.isEmpty) {
      return listings;
    }

    final filtered = listings.where((provider) {
      final haystack = [
        provider.location,
        provider.description,
        ...provider.services,
        ...provider.specialties,
      ].join(' ').toLowerCase();
      return tokens.any(haystack.contains);
    }).toList();

    final visible = filtered.isEmpty ? listings : filtered;

    if (selection.latitude == null || selection.longitude == null) {
      return visible;
    }

    final withDistance = visible
        .map(
          (provider) => (
            provider: provider,
            distance: provider.latitude == null || provider.longitude == null
                ? double.infinity
                : _distanceKm(
                    selection.latitude!,
                    selection.longitude!,
                    provider.latitude!,
                    provider.longitude!,
                  ),
          ),
        )
        .toList()
      ..sort((a, b) => a.distance.compareTo(b.distance));

    return withDistance.map((item) => item.provider).toList();
  }

  double _distanceKm(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) {
    const earthRadiusKm = 6371.0;
    final dLat = _degToRad(endLat - startLat);
    final dLng = _degToRad(endLng - startLng);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(startLat)) *
            math.cos(_degToRad(endLat)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  double _degToRad(double value) => value * (math.pi / 180.0);

  Object? _decodeJson(String body) {
    if (body.isEmpty) {
      return null;
    }

    try {
      return jsonDecode(body) as Object?;
    } catch (_) {
      return null;
    }
  }

  String _readError(Object? body, int statusCode) {
    if (body is Map<String, dynamic>) {
      final error = body['error'];
      if (error is String && error.trim().isNotEmpty) {
        return error;
      }

      final errorMessage = body['errorMessage'];
      if (errorMessage is String && errorMessage.trim().isNotEmpty) {
        return errorMessage;
      }
    }

    return 'Unable to load providers. Please try again.';
  }
}
