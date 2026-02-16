import 'package:dio/dio.dart';

const nominatimBase = 'https://nominatim.openstreetmap.org';

final nominatimDio = Dio(BaseOptions(
  baseUrl: nominatimBase,
  headers: {
    'Accept-Language': 'pt-BR,pt,en',
    'User-Agent': 'CRM-Builder-Mobile/1.0',
  },
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 10),
));

Map<String, String> extractAddressParts(Map<String, dynamic>? addr) {
  if (addr == null) {
    return {'uf': '', 'city': '', 'address': '', 'number': ''};
  }
  final uf = (addr['state'] ?? '') as String;
  final city = (addr['city'] ?? addr['town'] ?? addr['village'] ??
      addr['municipality'] ?? addr['city_district'] ?? '') as String;
  final address =
      (addr['road'] ?? addr['neighbourhood'] ?? addr['suburb'] ?? '') as String;
  final number = (addr['house_number'] ?? '') as String;
  return {'uf': uf, 'city': city, 'address': address, 'number': number};
}

String formatAddress(Map<String, String> parts) {
  return [parts['uf'], parts['city'], parts['address'], parts['number']]
      .where((s) => s != null && s.isNotEmpty)
      .join(', ');
}

Future<List<Map<String, dynamic>>> geocodeAddress(String query) async {
  try {
    final res = await nominatimDio.get('/search', queryParameters: {
      'q': query,
      'format': 'json',
      'limit': '5',
      'countrycodes': 'br',
      'addressdetails': '1',
    });
    final list = res.data;
    if (list is List) return list.cast<Map<String, dynamic>>();
  } catch (_) {}
  return [];
}

Future<Map<String, dynamic>?> reverseGeocode(double lat, double lng) async {
  try {
    final res = await nominatimDio.get('/reverse', queryParameters: {
      'lat': lat.toString(),
      'lon': lng.toString(),
      'format': 'json',
      'addressdetails': '1',
    });
    return res.data as Map<String, dynamic>?;
  } catch (_) {}
  return null;
}
