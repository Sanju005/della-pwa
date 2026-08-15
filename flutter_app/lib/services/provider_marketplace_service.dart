import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../models/provider_summary.dart';

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

  Future<ProviderCatalogResult> fetchCatalog({String? service}) async {
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
        return ProviderCatalogResult.fromJson(body);
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

  Future<List<ProviderSummary>> fetchVisibleProviders({String? service}) async {
    final catalog = await fetchCatalog(service: service);
    return catalog.listings;
  }

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
