import 'package:intl/intl.dart';

class Formatters {
  Formatters._();

  static final _dateFmt = DateFormat('dd/MM/yyyy');
  static final _dateTimeFmt = DateFormat('dd/MM/yyyy HH:mm');
  static final _currencyFmt = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

  static String date(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '-';
    try {
      return _dateFmt.format(DateTime.parse(isoDate));
    } catch (_) {
      return isoDate;
    }
  }

  static String dateTime(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '-';
    try {
      return _dateTimeFmt.format(DateTime.parse(isoDate));
    } catch (_) {
      return isoDate;
    }
  }

  static String currency(num? value) {
    if (value == null) return '-';
    return _currencyFmt.format(value);
  }

  static String initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  static String timeAgo(String? isoDate) {
    if (isoDate == null) return '';
    try {
      final date = DateTime.parse(isoDate);
      final diff = DateTime.now().difference(date);
      if (diff.inMinutes < 1) return 'agora';
      if (diff.inMinutes < 60) return '${diff.inMinutes}min';
      if (diff.inHours < 24) return '${diff.inHours}h';
      if (diff.inDays < 30) return '${diff.inDays}d';
      return Formatters.date(isoDate);
    } catch (_) {
      return isoDate;
    }
  }
}
