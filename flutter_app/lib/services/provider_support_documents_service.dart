import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

/// A provider's self-service "Support Documents" (driving license, other
/// certificates). Deliberately separate from identity/phone/email
/// verification — uploading or removing one never changes any verification
/// status.
class ProviderSupportDocument {
  const ProviderSupportDocument({
    required this.id,
    required this.label,
    required this.fileName,
    required this.mimeType,
    required this.uploadedAt,
    required this.previewUrl,
  });

  final String id;
  final String label;
  final String fileName;
  final String mimeType;
  final String uploadedAt;
  final String previewUrl;

  bool get isPdf => mimeType == 'application/pdf';

  factory ProviderSupportDocument.fromJson(Map<String, dynamic> json) {
    return ProviderSupportDocument(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      fileName: json['fileName'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? '',
      uploadedAt: json['uploadedAt'] as String? ?? '',
      previewUrl: json['previewUrl'] as String? ?? '',
    );
  }
}

class ProviderSupportDocumentsService {
  const ProviderSupportDocumentsService();

  Future<List<ProviderSupportDocument>> fetchDocuments() async {
    final response = await http.get(
      Uri.parse('${AppConfig.appBaseUrl}/api/provider/support-documents'),
      headers: await _headers(),
    );
    return _parseDocuments(response);
  }

  Future<List<ProviderSupportDocument>> uploadDocument({
    required String fileName,
    required String dataUrl,
    String? label,
  }) async {
    final response = await http.post(
      Uri.parse('${AppConfig.appBaseUrl}/api/provider/support-documents'),
      headers: await _headers(includeJson: true),
      body: jsonEncode({
        'fileName': fileName,
        'dataUrl': dataUrl,
        if (label != null && label.trim().isNotEmpty) 'label': label.trim(),
      }),
    );
    return _parseDocuments(response);
  }

  Future<List<ProviderSupportDocument>> deleteDocument(String id) async {
    final response = await http.delete(
      Uri.parse('${AppConfig.appBaseUrl}/api/provider/support-documents'),
      headers: await _headers(includeJson: true),
      body: jsonEncode({'id': id}),
    );
    return _parseDocuments(response);
  }

  List<ProviderSupportDocument> _parseDocuments(http.Response response) {
    final body = _decodeMap(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return (body['documents'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map((key, value) => MapEntry(key.toString(), value)),
          )
          .map(ProviderSupportDocument.fromJson)
          .toList();
    }
    throw Exception(_readError(body));
  }

  Future<Map<String, String>> _headers({bool includeJson = false}) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (includeJson) 'Content-Type': 'application/json',
    };
    final accessToken =
        Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }
    headers['Authorization'] = 'Bearer $accessToken';
    return headers;
  }

  Map<String, dynamic> _decodeMap(String body) {
    if (body.isEmpty) {
      return const {};
    }
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Fall through to empty map.
    }
    return const {};
  }

  String _readError(Map<String, dynamic> body) {
    final error = body['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }
    return 'Unable to load support documents. Please try again.';
  }
}
