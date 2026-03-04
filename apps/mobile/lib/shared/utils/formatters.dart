import 'package:intl/intl.dart';

/// Formatadores centralizados — espelha packages/shared/src/formatters.ts
class Formatters {
  Formatters._();

  // =========================================================================
  // FORMATADORES DE INSTANCIA (cacheados)
  // =========================================================================

  static final _dateFmt = DateFormat('dd/MM/yyyy');
  static final _dateTimeFmt = DateFormat('dd/MM/yyyy HH:mm');
  static final _timeFmt = DateFormat('HH:mm');
  static final _currencyFmt =
      NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  static final _numberFmt = NumberFormat('#,##0.##', 'pt_BR');
  static final _percentFmt = NumberFormat('#,##0.00', 'pt_BR');

  // =========================================================================
  // FORMATADORES INDIVIDUAIS
  // =========================================================================

  static String date(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '-';
    try {
      return _dateFmt.format(DateTime.parse(isoDate).toLocal());
    } catch (_) {
      return isoDate;
    }
  }

  static String dateTime(String? isoDate) {
    if (isoDate == null || isoDate.isEmpty) return '-';
    try {
      return _dateTimeFmt.format(DateTime.parse(isoDate).toLocal());
    } catch (_) {
      return isoDate;
    }
  }

  static String time(String? value) {
    if (value == null || value.isEmpty) return '-';
    try {
      return _timeFmt.format(DateTime.parse(value).toLocal());
    } catch (_) {
      // Pode ser string "14:30" direta
      return value;
    }
  }

  static String currency(num? value) {
    if (value == null) return '-';
    return _currencyFmt.format(value);
  }

  static String number(num? value) {
    if (value == null) return '-';
    return _numberFmt.format(value);
  }

  static String percentage(num? value, {int decimals = 2}) {
    if (value == null) return '-';
    return '${_percentFmt.format(value)}%';
  }

  static String boolean(dynamic value,
      {String t = 'Sim', String f = 'Nao'}) {
    final boolVal =
        value == true || value == 'true' || value == '1' || value == 1;
    return boolVal ? t : f;
  }

  static String cpf(String? value) {
    if (value == null || value.isEmpty) return '-';
    final digits = value.replaceAll(RegExp(r'\D'), '').padLeft(11, '0');
    if (digits.length != 11) return value;
    return '${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9, 11)}';
  }

  static String cnpj(String? value) {
    if (value == null || value.isEmpty) return '-';
    final digits = value.replaceAll(RegExp(r'\D'), '').padLeft(14, '0');
    if (digits.length != 14) return value;
    return '${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12, 14)}';
  }

  static String cep(String? value) {
    if (value == null || value.isEmpty) return '-';
    final digits = value.replaceAll(RegExp(r'\D'), '').padLeft(8, '0');
    if (digits.length != 8) return value;
    return '${digits.substring(0, 5)}-${digits.substring(5, 8)}';
  }

  static String phone(String? value) {
    if (value == null || value.isEmpty) return '-';
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 11) {
      return '(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}';
    }
    if (digits.length == 10) {
      return '(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}';
    }
    return value;
  }

  static String rating(num? value, {int max = 5}) {
    if (value == null) return '-';
    return '$value/$max';
  }

  static String duration(int? milliseconds) {
    if (milliseconds == null || milliseconds < 0) return '-';
    final totalSeconds = milliseconds ~/ 1000;
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;

    final parts = <String>[];
    if (hours > 0) parts.add('${hours}h');
    if (minutes > 0) parts.add('${minutes}m');
    if (seconds > 0 || parts.isEmpty) parts.add('${seconds}s');
    return parts.join(' ');
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
      final d = DateTime.parse(isoDate);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'agora';
      if (diff.inMinutes < 60) return '${diff.inMinutes}min';
      if (diff.inHours < 24) return '${diff.inHours}h';
      if (diff.inDays < 30) return '${diff.inDays}d';
      return Formatters.date(isoDate);
    } catch (_) {
      return isoDate;
    }
  }

  // =========================================================================
  // FUNCAO PRINCIPAL — espelha formatFieldValue do shared/formatters.ts
  // =========================================================================

  /// Formata um valor de campo para exibicao, baseado no tipo do campo.
  static String formatFieldValue(
    dynamic value,
    String fieldType, {
    String emptyValue = '-',
    String boolTrue = 'Sim',
    String boolFalse = 'Nao',
  }) {
    if (value == null) return emptyValue;
    if (value is String && value.isEmpty) return emptyValue;

    // Extrair label de {value, label}
    if (value is Map) {
      if (value.containsKey('label') && value['label'] != null) {
        return value['label'].toString();
      }
      if (value.containsKey('name') && value['name'] != null) {
        return value['name'].toString();
      }
    }

    switch (fieldType) {
      // Texto simples
      case 'text':
      case 'textarea':
      case 'email':
      case 'url':
        return value.toString();

      case 'richtext':
        return _stripHtml(value.toString());

      // Numericos
      case 'number':
      case 'slider':
        final n = num.tryParse(value.toString());
        return n != null ? number(n) : value.toString();

      case 'currency':
        final n = num.tryParse(value.toString());
        return n != null ? currency(n) : value.toString();

      case 'percentage':
        final n = num.tryParse(value.toString());
        return n != null ? percentage(n) : value.toString();

      case 'formula':
      case 'rollup':
        final n = num.tryParse(value.toString());
        return n != null ? number(n) : value.toString();

      case 'rating':
        final n = num.tryParse(value.toString());
        return n != null ? rating(n) : emptyValue;

      // Datas
      case 'date':
        return date(value.toString());

      case 'datetime':
        return dateTime(value.toString());

      case 'time':
        return time(value.toString());

      // Boolean
      case 'boolean':
        return boolean(value, t: boolTrue, f: boolFalse);

      // Mascaras BR
      case 'cpf':
        return cpf(value.toString());

      case 'cnpj':
        return cnpj(value.toString());

      case 'cep':
        return cep(value.toString());

      case 'phone':
        return phone(value.toString());

      // Select/Relation (objetos {value, label})
      case 'select':
      case 'api-select':
      case 'relation':
      case 'user-select':
      case 'workflow-status':
      case 'radio-group':
      case 'lookup':
        return _extractLabel(value) ?? emptyValue;

      // Arrays
      case 'multiselect':
      case 'checkbox-group':
      case 'tags':
      case 'array':
        return _formatArray(value);

      // Arquivos
      case 'file':
      case 'image':
        return _formatFileCount(value, fieldType);

      // Cor
      case 'color':
        return value.toString();

      // Map/Endereco
      case 'map':
        return _extractMapAddress(value) ?? emptyValue;

      // Especiais
      case 'password':
        return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

      case 'hidden':
        return '';

      case 'json':
        return value is String ? value : value.toString();

      case 'sub-entity':
        if (value is num) {
          return value == 1 ? '1 registro' : '$value registros';
        }
        return emptyValue;

      case 'timer':
        final ms = int.tryParse(value.toString());
        return ms != null ? duration(ms) : emptyValue;

      case 'sla-status':
        return value.toString();

      case 'signature':
        if (value != null && value.toString().isNotEmpty) {
          return 'Assinado';
        }
        return emptyValue;

      case 'zone-diagram':
      case 'action-button':
      case 'section-title':
        return emptyValue;

      default:
        return value.toString();
    }
  }

  // =========================================================================
  // HELPERS PRIVADOS
  // =========================================================================

  static String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .trim();
  }

  static String? _extractLabel(dynamic value) {
    if (value == null) return null;
    if (value is Map) {
      if (value.containsKey('label') && value['label'] != null) {
        return value['label'].toString();
      }
      if (value.containsKey('name') && value['name'] != null) {
        return value['name'].toString();
      }
      if (value.containsKey('value') && value['value'] != null) {
        return value['value'].toString();
      }
    }
    if (value is String) return value;
    return value.toString();
  }

  static String _formatArray(dynamic value) {
    if (value is! List || value.isEmpty) return '-';
    return value.map((v) {
      final label = _extractLabel(v);
      return label ?? v.toString();
    }).join(', ');
  }

  static String _formatFileCount(dynamic value, String fieldType) {
    if (value is List) {
      final count = value.length;
      if (fieldType == 'image') {
        return count == 1 ? '1 imagem' : '$count imagens';
      }
      return count == 1 ? '1 arquivo' : '$count arquivos';
    }
    if (value is String) {
      final parts = value.split('/');
      return parts.last;
    }
    return '-';
  }

  static String? _extractMapAddress(dynamic value) {
    if (value is Map) {
      if (value.containsKey('address') && value['address'] != null) {
        return value['address'].toString();
      }
      if (value.containsKey('lat') && value.containsKey('lng')) {
        return '${value['lat']}, ${value['lng']}';
      }
    }
    return null;
  }
}
