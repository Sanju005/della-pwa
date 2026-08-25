import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

List<String> _providerWorkspaceStringList(dynamic value) {
  return (value as List<dynamic>? ?? const [])
      .map((item) => item?.toString() ?? '')
      .where((item) => item.trim().isNotEmpty)
      .toList(growable: false);
}

class ProviderWorkspaceServiceModel {
  const ProviderWorkspaceServiceModel({
    required this.id,
    required this.serviceType,
    required this.yearsExperience,
    required this.hourlyRate,
    required this.dailyRate,
    required this.specialties,
    required this.imageDataUrls,
    required this.imageCaptions,
    required this.certificateDataUrls,
    required this.certificateCaptions,
  });

  final String id;
  final String serviceType;
  final String yearsExperience;
  final double hourlyRate;
  final double dailyRate;
  final List<String> specialties;
  final List<String> imageDataUrls;
  final List<String> imageCaptions;
  final List<String> certificateDataUrls;
  final List<String> certificateCaptions;

  factory ProviderWorkspaceServiceModel.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceServiceModel(
      id: json['id'] as String? ?? '',
      serviceType: json['serviceType'] as String? ?? '',
      yearsExperience: json['yearsExperience'] as String? ?? '',
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      dailyRate: (json['dailyRate'] as num?)?.toDouble() ?? 0,
      specialties: _providerWorkspaceStringList(json['specialties']),
      imageDataUrls: _providerWorkspaceStringList(json['imageDataUrls']),
      imageCaptions: _providerWorkspaceStringList(json['imageCaptions']),
      certificateDataUrls:
          _providerWorkspaceStringList(json['certificateDataUrls']),
      certificateCaptions:
          _providerWorkspaceStringList(json['certificateCaptions']),
    );
  }
}

class ProviderWorkspaceProfile {
  const ProviderWorkspaceProfile({
    required this.providerId,
    required this.fullName,
    required this.firstName,
    required this.lastName,
    required this.dateOfBirth,
    required this.gender,
    required this.email,
    required this.phone,
    required this.emergencyContactNumber,
    required this.avatarUrl,
    required this.accountStatus,
    required this.marketingName,
    required this.addressLine1,
    required this.addressLine2,
    required this.postcode,
    required this.city,
    required this.state,
    required this.serviceLocation,
    required this.serviceRadiusKm,
    required this.country,
    required this.bio,
    required this.averageRating,
    required this.totalReviews,
    required this.approvalStatus,
    required this.isVisible,
    required this.emailVerified,
    required this.phoneVerified,
    required this.identityVerified,
    required this.identityVerificationStatus,
    required this.identityDocumentType,
    required this.identityFrontImageUrl,
    required this.identityBackImageUrl,
    required this.kycVerified,
    required this.backgroundCheckVerified,
    required this.services,
  });

  final String providerId;
  final String fullName;
  final String firstName;
  final String lastName;
  final String dateOfBirth;
  final String gender;
  final String email;
  final String phone;
  final String emergencyContactNumber;
  final String avatarUrl;
  final String accountStatus;
  final String marketingName;
  final String addressLine1;
  final String addressLine2;
  final String postcode;
  final String city;
  final String state;
  final String serviceLocation;
  final double serviceRadiusKm;
  final String country;
  final String bio;
  final double averageRating;
  final int totalReviews;
  final String approvalStatus;
  final bool isVisible;
  final bool emailVerified;
  final bool phoneVerified;
  final bool identityVerified;
  final String identityVerificationStatus;
  final String identityDocumentType;
  final String identityFrontImageUrl;
  final String identityBackImageUrl;
  final bool kycVerified;
  final bool backgroundCheckVerified;
  final List<ProviderWorkspaceServiceModel> services;

  factory ProviderWorkspaceProfile.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceProfile(
      providerId: json['providerId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      dateOfBirth: json['dateOfBirth'] as String? ?? '',
      gender: json['gender'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      emergencyContactNumber:
          json['emergencyContactNumber'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? '',
      accountStatus: json['accountStatus'] as String? ?? 'Pending',
      marketingName: json['marketingName'] as String? ?? '',
      addressLine1: json['addressLine1'] as String? ?? '',
      addressLine2: json['addressLine2'] as String? ?? '',
      postcode: json['postcode'] as String? ?? '',
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      serviceLocation: json['serviceLocation'] as String? ?? '',
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toDouble() ?? 0,
      country: json['country'] as String? ?? 'Malaysia',
      bio: json['bio'] as String? ?? '',
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
      approvalStatus: json['approvalStatus'] as String? ?? 'Pending',
      isVisible: json['isVisible'] == true,
      emailVerified: json['emailVerified'] == true,
      phoneVerified: json['phoneVerified'] == true,
      identityVerified: json['identityVerified'] == true,
      identityVerificationStatus:
          json['identityVerificationStatus'] as String? ?? 'pending',
      identityDocumentType: json['identityDocumentType'] as String? ?? '',
      identityFrontImageUrl: json['identityFrontImageUrl'] as String? ?? '',
      identityBackImageUrl: json['identityBackImageUrl'] as String? ?? '',
      kycVerified: json['kycVerified'] == true,
      backgroundCheckVerified: json['backgroundCheckVerified'] == true,
      services: (json['services'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderWorkspaceServiceModel.fromJson)
          .toList(growable: false),
    );
  }
}

class ProviderWorkspaceBooking {
  const ProviderWorkspaceBooking({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.serviceLabel,
    required this.serviceKey,
    required this.location,
    required this.bookingMode,
    required this.bookingStatus,
    required this.statusLabel,
    required this.customerStatusLabel,
    required this.bucket,
    required this.scheduledDate,
    required this.scheduledStartTime,
    required this.scheduledEndTime,
    required this.schedule,
    required this.customerNote,
    required this.providerResponseNote,
    required this.quotedAmount,
    required this.paymentStatus,
    required this.paymentOption,
    required this.companyCommissionAmount,
    required this.providerNetAmount,
    required this.createdAt,
    required this.baseAmount,
    required this.additionalCharge,
    required this.additionalChargeDescription,
    required this.paymentNote,
    required this.companyPaymentStatus,
    required this.acceptedAt,
    required this.onTheWayAt,
    required this.arrivedAt,
    required this.completedAt,
    required this.paidAt,
    required this.reviewRequestedAt,
    required this.providerReviewedAt,
    required this.reviewedAt,
    required this.providerReviewStatus,
    required this.providerReviewRating,
    required this.providerReviewComment,
    required this.workFinishedImages,
    required this.customerPaymentProofDataUrl,
  });

  final String id;
  final String customerId;
  final String customerName;
  final String serviceLabel;
  final String serviceKey;
  final String location;
  final String bookingMode;
  final String bookingStatus;
  final String statusLabel;
  final String customerStatusLabel;
  final String bucket;
  final String scheduledDate;
  final String scheduledStartTime;
  final String scheduledEndTime;
  final String schedule;
  final String customerNote;
  final String providerResponseNote;
  final double quotedAmount;
  final String paymentStatus;
  final String paymentOption;
  final double companyCommissionAmount;
  final double providerNetAmount;
  final String createdAt;
  final double baseAmount;
  final double additionalCharge;
  final String additionalChargeDescription;
  final String paymentNote;
  final String companyPaymentStatus;
  final String acceptedAt;
  final String onTheWayAt;
  final String arrivedAt;
  final String completedAt;
  final String paidAt;
  final String reviewRequestedAt;
  final String providerReviewedAt;
  final String reviewedAt;
  final String providerReviewStatus;
  final int providerReviewRating;
  final String providerReviewComment;
  final List<String> workFinishedImages;
  final String customerPaymentProofDataUrl;

  factory ProviderWorkspaceBooking.fromJson(Map<String, dynamic> json) {
    return ProviderWorkspaceBooking(
      id: json['id'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? 'Customer',
      serviceLabel: json['serviceLabel'] as String? ?? 'Service',
      serviceKey: json['serviceKey'] as String? ?? '',
      location: json['location'] as String? ?? '',
      bookingMode: json['bookingMode'] as String? ?? 'hourly',
      bookingStatus: json['bookingStatus'] as String? ?? 'pending',
      statusLabel: json['statusLabel'] as String? ?? 'Pending',
      customerStatusLabel: json['customerStatusLabel'] as String? ?? 'Pending',
      bucket: json['bucket'] as String? ?? 'active',
      scheduledDate: json['scheduledDate'] as String? ?? '',
      scheduledStartTime: json['scheduledStartTime'] as String? ?? '',
      scheduledEndTime: json['scheduledEndTime'] as String? ?? '',
      schedule: json['schedule'] as String? ?? '',
      customerNote: json['customerNote'] as String? ?? '',
      providerResponseNote: json['providerResponseNote'] as String? ?? '',
      quotedAmount: (json['quotedAmount'] as num?)?.toDouble() ?? 0,
      paymentStatus: json['paymentStatus'] as String? ?? 'pending',
      paymentOption: json['paymentOption'] as String? ?? 'cash',
      companyCommissionAmount:
          (json['companyCommissionAmount'] as num?)?.toDouble() ?? 0,
      providerNetAmount: (json['providerNetAmount'] as num?)?.toDouble() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
      baseAmount: (json['baseAmount'] as num?)?.toDouble() ??
          (json['quotedAmount'] as num?)?.toDouble() ??
          0,
      additionalCharge: (json['additionalCharge'] as num?)?.toDouble() ?? 0,
      additionalChargeDescription:
          json['additionalChargeDescription'] as String? ?? '',
      paymentNote: json['paymentNote'] as String? ?? '',
      companyPaymentStatus: json['companyPaymentStatus'] as String? ?? '',
      acceptedAt: json['acceptedAt'] as String? ?? '',
      onTheWayAt: json['onTheWayAt'] as String? ?? '',
      arrivedAt: json['arrivedAt'] as String? ?? '',
      completedAt: json['completedAt'] as String? ?? '',
      paidAt: json['paidAt'] as String? ?? '',
      reviewRequestedAt: json['reviewRequestedAt'] as String? ?? '',
      providerReviewedAt: json['providerReviewedAt'] as String? ?? '',
      reviewedAt: json['reviewedAt'] as String? ?? '',
      providerReviewStatus: json['providerReviewStatus'] as String? ?? '',
      providerReviewRating: (json['providerReviewRating'] as num?)?.toInt() ?? 0,
      providerReviewComment: json['providerReviewComment'] as String? ?? '',
      workFinishedImages:
          _providerWorkspaceStringList(json['workFinishedImages']),
      customerPaymentProofDataUrl:
          json['customerPaymentProofDataUrl'] as String? ?? '',
    );
  }
}

class ProviderMessageThread {
  const ProviderMessageThread({
    required this.bookingId,
    required this.counterpartId,
    required this.counterpartName,
    required this.serviceLabel,
    required this.location,
    required this.schedule,
    required this.preview,
    required this.lastMessageAt,
    required this.lastSenderRole,
    required this.unreadCount,
  });

  final String bookingId;
  final String counterpartId;
  final String counterpartName;
  final String serviceLabel;
  final String location;
  final String schedule;
  final String preview;
  final String lastMessageAt;
  final String lastSenderRole;
  final int unreadCount;

  factory ProviderMessageThread.fromJson(Map<String, dynamic> json) {
    return ProviderMessageThread(
      bookingId: json['bookingId'] as String? ?? '',
      counterpartId: json['counterpartId'] as String? ?? '',
      counterpartName: json['counterpartName'] as String? ?? 'Customer',
      serviceLabel: json['serviceLabel'] as String? ?? 'Service',
      location: json['location'] as String? ?? '',
      schedule: json['schedule'] as String? ?? '',
      preview: json['preview'] as String? ?? '',
      lastMessageAt: json['lastMessageAt'] as String? ?? '',
      lastSenderRole: json['lastSenderRole'] as String? ?? 'system',
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProviderConversationMessage {
  const ProviderConversationMessage({
    required this.id,
    required this.bookingId,
    required this.senderId,
    required this.senderRole,
    required this.senderName,
    required this.messageText,
    required this.attachmentDataUrl,
    required this.attachmentFileName,
    required this.attachmentMimeType,
    required this.createdAt,
    required this.isOwnMessage,
  });

  final String id;
  final String bookingId;
  final String senderId;
  final String senderRole;
  final String senderName;
  final String messageText;
  final String attachmentDataUrl;
  final String attachmentFileName;
  final String attachmentMimeType;
  final String createdAt;
  final bool isOwnMessage;

  factory ProviderConversationMessage.fromJson(Map<String, dynamic> json) {
    return ProviderConversationMessage(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      senderRole: json['senderRole'] as String? ?? 'system',
      senderName: json['senderName'] as String? ?? 'User',
      messageText: json['messageText'] as String? ?? '',
      attachmentDataUrl: json['attachmentDataUrl'] as String? ?? '',
      attachmentFileName: json['attachmentFileName'] as String? ?? '',
      attachmentMimeType: json['attachmentMimeType'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      isOwnMessage: json['isOwnMessage'] == true,
    );
  }
}

class ProviderConversationDetail {
  const ProviderConversationDetail({
    required this.bookingId,
    required this.counterpartId,
    required this.counterpartName,
    required this.serviceLabel,
    required this.location,
    required this.schedule,
    required this.messages,
    required this.unreadCount,
    required this.canSendMessages,
    required this.bookingStatus,
  });

  final String bookingId;
  final String counterpartId;
  final String counterpartName;
  final String serviceLabel;
  final String location;
  final String schedule;
  final List<ProviderConversationMessage> messages;
  final int unreadCount;
  final bool canSendMessages;
  final String bookingStatus;

  factory ProviderConversationDetail.fromJson(Map<String, dynamic> json) {
    return ProviderConversationDetail(
      bookingId: json['bookingId'] as String? ?? '',
      counterpartId: json['counterpartId'] as String? ?? '',
      counterpartName: json['counterpartName'] as String? ?? 'Customer',
      serviceLabel: json['serviceLabel'] as String? ?? 'Service',
      location: json['location'] as String? ?? '',
      schedule: json['schedule'] as String? ?? '',
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderConversationMessage.fromJson)
          .toList(growable: false),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      canSendMessages: json['canSendMessages'] == true,
      bookingStatus: json['bookingStatus'] as String? ?? 'pending',
    );
  }
}

class ProviderAvailabilityEntry {
  const ProviderAvailabilityEntry({
    required this.id,
    required this.day,
    required this.dayKey,
    required this.timeMode,
    required this.startTime,
    required this.endTime,
  });

  final String id;
  final String day;
  final String dayKey;
  final String timeMode;
  final String startTime;
  final String endTime;

  factory ProviderAvailabilityEntry.fromJson(Map<String, dynamic> json) {
    return ProviderAvailabilityEntry(
      id: json['id'] as String? ?? '',
      day: json['day'] as String? ?? '',
      dayKey: json['dayKey'] as String? ?? '',
      timeMode: json['timeMode'] as String? ?? 'custom',
      startTime: json['startTime'] as String? ?? '08:00',
      endTime: json['endTime'] as String? ?? '20:00',
    );
  }
}

class ProviderAvailabilitySnapshot {
  const ProviderAvailabilitySnapshot({
    required this.enabled,
    required this.entries,
  });

  final bool enabled;
  final List<ProviderAvailabilityEntry> entries;

  factory ProviderAvailabilitySnapshot.fromJson(Map<String, dynamic> json) {
    return ProviderAvailabilitySnapshot(
      enabled: json['enabled'] == true,
      entries: (json['entries'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => item.map(
              (key, value) => MapEntry(key.toString(), value),
            ),
          )
          .map(ProviderAvailabilityEntry.fromJson)
          .toList(growable: false),
    );
  }
}

class ProviderReviewItem {
  const ProviderReviewItem({
    required this.id,
    required this.customerName,
    required this.rating,
    required this.comment,
    required this.createdAt,
    required this.createdLabel,
  });

  final String id;
  final String customerName;
  final int rating;
  final String comment;
  final String createdAt;
  final String createdLabel;

  factory ProviderReviewItem.fromJson(Map<String, dynamic> json) {
    return ProviderReviewItem(
      id: json['id'] as String? ?? '',
      customerName: json['customerName'] as String? ?? 'Customer',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      comment: json['comment'] as String? ?? 'Shared feedback',
      createdAt: json['createdAt'] as String? ?? '',
      createdLabel: json['createdLabel'] as String? ?? '',
    );
  }
}

class ProviderWorkspaceSnapshot {
  const ProviderWorkspaceSnapshot({
    required this.profile,
    required this.bookings,
  });

  final ProviderWorkspaceProfile profile;
  final List<ProviderWorkspaceBooking> bookings;
}

class ProviderWorkspaceService {
  const ProviderWorkspaceService();

  Future<ProviderWorkspaceSnapshot> fetchWorkspace() async {
    final results = await Future.wait<Object>([
      fetchProfile(),
      fetchBookings(),
    ]);
    return ProviderWorkspaceSnapshot(
      profile: results[0] as ProviderWorkspaceProfile,
      bookings: results[1] as List<ProviderWorkspaceBooking>,
    );
  }

  Future<ProviderWorkspaceProfile> fetchProfile() async {
    final response = await _request('GET', '/api/provider/me');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderWorkspaceProfile.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to load provider profile.'));
  }

  Future<List<ProviderWorkspaceBooking>> fetchBookings() async {
    final response = await _request('GET', '/api/provider/bookings');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return _listOfMaps(body['bookings'])
          .map(ProviderWorkspaceBooking.fromJson)
          .toList(growable: false);
    }
    throw Exception(_readError(body, 'Unable to load provider bookings.'));
  }

  Future<ProviderAvailabilitySnapshot> fetchAvailability() async {
    final response = await _request('GET', '/api/provider/availability');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderAvailabilitySnapshot.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to load provider availability.'));
  }

  Future<void> saveAvailability({
    required bool enabled,
    required List<ProviderAvailabilityEntry> entries,
  }) async {
    final response = await _request(
      'PUT',
      '/api/provider/availability',
      body: {
        'enabled': enabled,
        'entries': entries
            .map(
              (entry) => {
                'day': entry.day,
                'startTime': entry.startTime,
                'endTime': entry.endTime,
                'timeMode': entry.timeMode,
              },
            )
            .toList(growable: false),
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to save provider availability.'));
    }
  }

  Future<List<ProviderReviewItem>> fetchReviews() async {
    final response = await _request('GET', '/api/provider/reviews');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return _listOfMaps(body['reviews'])
          .map(ProviderReviewItem.fromJson)
          .toList(growable: false);
    }
    throw Exception(_readError(body, 'Unable to load provider reviews.'));
  }

  Future<List<ProviderMessageThread>> fetchMessageThreads() async {
    final response = await _request('GET', '/api/provider/messages');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return _listOfMaps(body['threads'])
          .map(ProviderMessageThread.fromJson)
          .toList(growable: false);
    }
    throw Exception(_readError(body, 'Unable to load provider messages.'));
  }

  Future<ProviderConversationDetail> fetchMessageThreadDetail(
    String bookingId,
  ) async {
    final response = await _request('GET', '/api/provider/messages/$bookingId');
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      final thread = body['thread'];
      if (thread is Map) {
        return ProviderConversationDetail.fromJson(
          thread.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    }
    throw Exception(_readError(body, 'Unable to load conversation.'));
  }

  Future<ProviderConversationDetail> sendMessage({
    required String bookingId,
    required String messageText,
    String attachmentDataUrl = '',
    String attachmentFileName = '',
    String attachmentMimeType = '',
  }) async {
    final response = await _request(
      'POST',
      '/api/provider/messages/$bookingId',
      body: {
        'messageText': messageText,
        'attachmentDataUrl': attachmentDataUrl,
        'attachmentFileName': attachmentFileName,
        'attachmentMimeType': attachmentMimeType,
      },
    );
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      final thread = body['thread'];
      if (thread is Map) {
        return ProviderConversationDetail.fromJson(
          thread.map((key, value) => MapEntry(key.toString(), value)),
        );
      }
    }
    throw Exception(_readError(body, 'Unable to send message.'));
  }

  Future<void> markConversationRead(String bookingId) async {
    final response = await _request('PATCH', '/api/provider/messages/$bookingId');
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(
        _readError(body, 'Unable to mark conversation as read.'),
      );
    }
  }

  Future<ProviderWorkspaceProfile> updateProfile({
    String? fullName,
    String? firstName,
    String? lastName,
    String? dateOfBirth,
    String? gender,
    String? email,
    String? phone,
    String? avatarUrl,
    String? marketingName,
    String? addressLine1,
    String? addressLine2,
    String? postcode,
    String? city,
    String? state,
    String? serviceLocation,
    double? serviceRadiusKm,
    String? bio,
    String? country,
    String? emergencyContactNumber,
    bool? phoneVerified,
    bool? identityVerified,
    String? identityVerificationStatus,
    String? identityDocumentType,
    String? identityFrontImageUrl,
    String? identityBackImageUrl,
  }) async {
    final payload = <String, dynamic>{};
    if (fullName != null) payload['fullName'] = fullName;
    if (firstName != null) payload['firstName'] = firstName;
    if (lastName != null) payload['lastName'] = lastName;
    if (dateOfBirth != null) payload['dateOfBirth'] = dateOfBirth;
    if (gender != null) payload['gender'] = gender;
    if (email != null) payload['email'] = email;
    if (phone != null) payload['phone'] = phone;
    if (avatarUrl != null) payload['avatarUrl'] = avatarUrl;
    if (marketingName != null) payload['marketingName'] = marketingName;
    if (addressLine1 != null) payload['addressLine1'] = addressLine1;
    if (addressLine2 != null) payload['addressLine2'] = addressLine2;
    if (postcode != null) payload['postcode'] = postcode;
    if (city != null) payload['city'] = city;
    if (state != null) payload['state'] = state;
    if (serviceLocation != null) payload['serviceLocation'] = serviceLocation;
    if (serviceRadiusKm != null) payload['serviceRadiusKm'] = serviceRadiusKm;
    if (bio != null) payload['bio'] = bio;
    if (country != null) payload['country'] = country;
    if (emergencyContactNumber != null) {
      payload['emergencyContactNumber'] = emergencyContactNumber;
    }
    if (phoneVerified != null) payload['phoneVerified'] = phoneVerified;
    if (identityVerified != null) payload['identityVerified'] = identityVerified;
    if (identityVerificationStatus != null) {
      payload['identityVerificationStatus'] = identityVerificationStatus;
    }
    if (identityDocumentType != null) {
      payload['identityDocumentType'] = identityDocumentType;
    }
    if (identityFrontImageUrl != null) {
      payload['identityFrontImageUrl'] = identityFrontImageUrl;
    }
    if (identityBackImageUrl != null) {
      payload['identityBackImageUrl'] = identityBackImageUrl;
    }

    final response = await _request(
      'PATCH',
      '/api/provider/me',
      body: payload,
    );
    final body = _decodeMap(response.body);
    if (_isSuccess(response.statusCode)) {
      return ProviderWorkspaceProfile.fromJson(body);
    }
    throw Exception(_readError(body, 'Unable to update provider profile.'));
  }

  Future<void> createService({
    required String serviceType,
    required String yearsExperience,
    required double hourlyRate,
    required double dailyRate,
    required List<String> specialties,
    required List<String> imageDataUrls,
    required List<String> imageCaptions,
    List<String> certificateDataUrls = const [],
    List<String> certificateCaptions = const [],
  }) async {
    final response = await _request(
      'POST',
      '/api/provider/services',
      body: {
        'serviceType': serviceType,
        'yearsExperience': yearsExperience,
        'hourlyRate': hourlyRate,
        'dailyRate': dailyRate,
        'specialties': specialties,
        'imageDataUrls': imageDataUrls,
        'imageCaptions': imageCaptions,
        'certificateDataUrls': certificateDataUrls,
        'certificateCaptions': certificateCaptions,
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to add provider service.'));
    }
  }

  Future<void> updateService({
    required String serviceId,
    required String yearsExperience,
    required double hourlyRate,
    required double dailyRate,
    required List<String> specialties,
    required List<String> imageDataUrls,
    required List<String> imageCaptions,
    List<String> certificateDataUrls = const [],
    List<String> certificateCaptions = const [],
  }) async {
    final response = await _request(
      'PATCH',
      '/api/provider/services/$serviceId',
      body: {
        'yearsExperience': yearsExperience,
        'hourlyRate': hourlyRate,
        'dailyRate': dailyRate,
        'specialties': specialties,
        'imageDataUrls': imageDataUrls,
        'imageCaptions': imageCaptions,
        'certificateDataUrls': certificateDataUrls,
        'certificateCaptions': certificateCaptions,
      },
    );
    final data = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode)) {
      throw Exception(_readError(data, 'Unable to update provider service.'));
    }
  }

  Future<void> updateBookingStatus({
    required String bookingId,
    required String status,
    String note = '',
    double? finalAmount,
    List<String>? workFinishedImages,
    List<Map<String, dynamic>>? paymentBreakdown,
  }) async {
    final payload = <String, dynamic>{
      'status': status,
      'note': note,
    };
    if (finalAmount != null) payload['finalAmount'] = finalAmount;
    if (workFinishedImages != null) {
      payload['workFinishedImages'] = workFinishedImages;
    }
    if (paymentBreakdown != null) {
      payload['paymentBreakdown'] = paymentBreakdown;
    }

    final response = await _request(
      'PATCH',
      '/api/provider/bookings/$bookingId',
      body: payload,
    );
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode) || body['success'] != true) {
      throw Exception(_readError(body, 'Unable to update booking.'));
    }
  }

  Future<void> submitProviderReview({
    required String bookingId,
    required int rating,
    required String comment,
    List<String> photos = const [],
  }) async {
    final response = await _request(
      'POST',
      '/api/provider/bookings/$bookingId/review',
      body: {
        'rating': rating,
        'comment': comment,
        'photos': photos,
      },
    );
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode) || body['success'] != true) {
      throw Exception(_readError(body, 'Unable to submit provider review.'));
    }
  }

  Future<void> submitCompanyPayment({
    required double amount,
    String note = '',
    String attachmentDataUrl = '',
    String attachmentFileName = '',
    String attachmentMimeType = '',
  }) async {
    final response = await _request(
      'POST',
      '/api/provider/company-payments',
      body: {
        'amount': amount,
        'amountPaid': amount,
        'note': note,
        'attachmentDataUrl': attachmentDataUrl,
        'attachmentFileName': attachmentFileName,
        'attachmentMimeType': attachmentMimeType,
        'paymentSlipDataUrl': attachmentDataUrl,
        'paymentSlipFileName': attachmentFileName,
        'paymentSlipMimeType': attachmentMimeType,
      },
    );
    final body = _decodeMap(response.body);
    if (!_isSuccess(response.statusCode) || body['success'] != true) {
      throw Exception(
        _readError(body, 'Unable to submit company payment.'),
      );
    }
  }

  Future<http.Response> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final session = Supabase.instance.client.auth.currentSession;
    final accessToken = session?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Please sign in again.');
    }

    final uri = Uri.parse('${AppConfig.appBaseUrl}$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }

    switch (method.toUpperCase()) {
      case 'GET':
        return http.get(uri, headers: headers);
      case 'POST':
        return http.post(uri, headers: headers, body: jsonEncode(body));
      case 'PATCH':
        return http.patch(uri, headers: headers, body: jsonEncode(body));
      case 'PUT':
        return http.put(uri, headers: headers, body: jsonEncode(body));
      default:
        throw UnsupportedError('Unsupported request method: $method');
    }
  }

  List<Map<String, dynamic>> _listOfMaps(dynamic value) {
    return (value as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => item.map(
            (key, data) => MapEntry(key.toString(), data),
          ),
        )
        .toList(growable: false);
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
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Provider workspace decode failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
    return const {};
  }

  bool _isSuccess(int statusCode) => statusCode >= 200 && statusCode < 300;

  String _readError(Map<String, dynamic> body, String fallback) {
    final error = body['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }
    return fallback;
  }
}
