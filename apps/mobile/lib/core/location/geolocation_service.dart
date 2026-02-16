import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:crm_mobile/core/location/nominatim_helpers.dart';

/// Service for capturing GPS position with optional reverse geocoding.
/// Returns data in MapFieldValue-compatible format:
/// {lat, lng, uf, city, address, number}
class GeolocationService {
  GeolocationService._();

  /// Capture current GPS position with best-effort reverse geocoding.
  /// Reverse geocode has a 3-second timeout; on failure returns just lat/lng.
  static Future<Map<String, dynamic>> captureLocation() async {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );

    final lat = double.parse(position.latitude.toStringAsFixed(6));
    final lng = double.parse(position.longitude.toStringAsFixed(6));

    final result = <String, dynamic>{
      'lat': lat,
      'lng': lng,
      'uf': '',
      'city': '',
      'address': '',
      'number': '',
    };

    // Best-effort reverse geocode with timeout
    try {
      final data = await reverseGeocode(lat, lng)
          .timeout(const Duration(seconds: 3));
      if (data != null) {
        final parts =
            extractAddressParts(data['address'] as Map<String, dynamic>?);
        result['uf'] = parts['uf'] ?? '';
        result['city'] = parts['city'] ?? '';
        result['number'] = parts['number'] ?? '';
        result['address'] = formatAddress(parts);
      }
    } catch (e) {
      debugPrint('[GeolocationService] Reverse geocode failed: $e');
    }

    return result;
  }
}
