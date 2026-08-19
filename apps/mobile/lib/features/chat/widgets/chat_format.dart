import 'package:flutter/material.dart';

/// Utilitarios de formatacao do chat (espelham o web: hueFor, dayLabel, hhmm).

/// Hue deterministico (0..359) a partir de uma string (ex.: senderId).
int hueFor(String id) {
  var h = 0;
  for (final c in id.codeUnits) {
    h = (h * 31 + c) & 0x7fffffff;
  }
  return h % 360;
}

/// Cor do avatar: bot (senderId null) = ambar; senao HSL pelo hue do id.
Color avatarColor(String? senderId) {
  if (senderId == null || senderId.isEmpty) {
    return const HSLColor.fromAHSL(1, 38, .92, .50).toColor();
  }
  return HSLColor.fromAHSL(1, hueFor(senderId).toDouble(), .55, .45).toColor();
}

/// Iniciais legiveis (1a + ultima letra), ou '?'.
String initials(String? name) {
  final n = (name ?? '').trim();
  if (n.isEmpty) return '?';
  final parts = n.split(RegExp(r'\s+'));
  if (parts.length == 1) {
    return parts.first.characters.first.toUpperCase();
  }
  return (parts.first.characters.first + parts.last.characters.first)
      .toUpperCase();
}

bool isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// Rotulo de divisoria de data: Hoje / Ontem / dd/MM[/aaaa].
String dayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(d.year, d.month, d.day);
  final diff = today.difference(that).inDays;
  if (diff == 0) return 'Hoje';
  if (diff == 1) return 'Ontem';
  final dd = d.day.toString().padLeft(2, '0');
  final mm = d.month.toString().padLeft(2, '0');
  return d.year == now.year ? '$dd/$mm' : '$dd/$mm/${d.year}';
}

/// HH:mm.
String hhmm(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

/// Parse tolerante de ISO8601 (retorna epoch se invalido).
DateTime parseTs(Object? v) {
  if (v is String) {
    return DateTime.tryParse(v)?.toLocal() ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}
