import 'package:crm_mobile/core/filters/filter_models.dart';

/// Builds SQLite WHERE clauses from filter lists using json_extract().
/// Used by DataRepository.watchRecords() to filter EntityData.data JSON.
class FilterSqlBuilder {
  FilterSqlBuilder._();

  /// Returns extra WHERE clauses and their parameter values.
  static ({String where, List<dynamic> params}) buildFilterClauses(
    List<GlobalFilter> globalFilters,
    List<LocalFilter> localFilters,
  ) {
    final clauses = <String>[];
    final params = <dynamic>[];

    for (final f in globalFilters) {
      final result = _buildClause(f.fieldSlug, f.fieldType, f.operator, f.value, f.value2);
      if (result.clause.isNotEmpty) {
        clauses.add(result.clause);
        params.addAll(result.params);
      }
    }

    for (final f in localFilters) {
      final result = _buildClause(f.fieldSlug, f.fieldType, f.operator, f.value, f.value2);
      if (result.clause.isNotEmpty) {
        clauses.add(result.clause);
        params.addAll(result.params);
      }
    }

    if (clauses.isEmpty) return (where: '', params: <dynamic>[]);
    return (where: ' AND ${clauses.join(' AND ')}', params: params);
  }

  static ({String clause, List<dynamic> params}) _buildClause(
    String fieldSlug,
    String fieldType,
    FilterOperator operator,
    dynamic value,
    dynamic value2,
  ) {
    final jsonPath = "json_extract(data, '\$.$fieldSlug')";
    final type = fieldType.toLowerCase();

    // isEmpty / isNotEmpty work for any type
    if (operator == FilterOperator.isEmpty) {
      return (
        clause: "($jsonPath IS NULL OR $jsonPath = '' OR $jsonPath = 'null')",
        params: <dynamic>[],
      );
    }
    if (operator == FilterOperator.isNotEmpty) {
      return (
        clause: "($jsonPath IS NOT NULL AND $jsonPath != '' AND $jsonPath != 'null')",
        params: <dynamic>[],
      );
    }

    const textTypes = [
      'text', 'textarea', 'richtext', 'email', 'phone', 'url',
      'cpf', 'cnpj', 'cep', 'password',
    ];
    const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider'];
    const dateTypes = ['date', 'datetime', 'time'];

    if (textTypes.contains(type)) {
      return _textClause(jsonPath, operator, value);
    }
    if (numberTypes.contains(type)) {
      return _numericClause(jsonPath, operator, value, value2);
    }
    if (dateTypes.contains(type)) {
      return _dateClause(jsonPath, operator, value, value2);
    }
    if (type == 'boolean') {
      return _boolClause(jsonPath, operator, value);
    }
    if (type == 'select' || type == 'multiselect' || type == 'api-select' || type == 'relation') {
      return _selectClause(jsonPath, operator, value);
    }
    // Fallback: treat as text
    return _textClause(jsonPath, operator, value);
  }

  static ({String clause, List<dynamic> params}) _textClause(
    String jsonPath, FilterOperator op, dynamic value,
  ) {
    final v = '$value';
    switch (op) {
      case FilterOperator.contains:
        return (clause: '$jsonPath LIKE ?', params: <dynamic>['%$v%']);
      case FilterOperator.equals:
        return (clause: '$jsonPath = ?', params: <dynamic>[v]);
      case FilterOperator.startsWith:
        return (clause: '$jsonPath LIKE ?', params: <dynamic>['$v%']);
      case FilterOperator.endsWith:
        return (clause: '$jsonPath LIKE ?', params: <dynamic>['%$v']);
      default:
        return (clause: '', params: <dynamic>[]);
    }
  }

  static ({String clause, List<dynamic> params}) _numericClause(
    String jsonPath, FilterOperator op, dynamic value, dynamic value2,
  ) {
    final cast = 'CAST($jsonPath AS REAL)';
    final v = _toNum(value);
    switch (op) {
      case FilterOperator.equals:
        return (clause: '$cast = ?', params: <dynamic>[v]);
      case FilterOperator.gt:
        return (clause: '$cast > ?', params: <dynamic>[v]);
      case FilterOperator.gte:
        return (clause: '$cast >= ?', params: <dynamic>[v]);
      case FilterOperator.lt:
        return (clause: '$cast < ?', params: <dynamic>[v]);
      case FilterOperator.lte:
        return (clause: '$cast <= ?', params: <dynamic>[v]);
      case FilterOperator.between:
        return (clause: '$cast BETWEEN ? AND ?', params: <dynamic>[v, _toNum(value2)]);
      default:
        return (clause: '', params: <dynamic>[]);
    }
  }

  static ({String clause, List<dynamic> params}) _dateClause(
    String jsonPath, FilterOperator op, dynamic value, dynamic value2,
  ) {
    final v = '$value';
    switch (op) {
      case FilterOperator.equals:
        return (clause: '$jsonPath = ?', params: <dynamic>[v]);
      case FilterOperator.gt:
        return (clause: '$jsonPath > ?', params: <dynamic>[v]);
      case FilterOperator.gte:
        return (clause: '$jsonPath >= ?', params: <dynamic>[v]);
      case FilterOperator.lt:
        return (clause: '$jsonPath < ?', params: <dynamic>[v]);
      case FilterOperator.lte:
        return (clause: '$jsonPath <= ?', params: <dynamic>[v]);
      case FilterOperator.between:
        return (clause: '$jsonPath BETWEEN ? AND ?', params: <dynamic>[v, '$value2']);
      default:
        return (clause: '', params: <dynamic>[]);
    }
  }

  static ({String clause, List<dynamic> params}) _boolClause(
    String jsonPath, FilterOperator op, dynamic value,
  ) {
    if (op == FilterOperator.equals) {
      // SQLite stores JSON booleans as 1/0 or "true"/"false"
      final boolStr = (value == true || value == 'true') ? 'true' : 'false';
      return (
        clause: '($jsonPath = ? OR $jsonPath = ?)',
        params: <dynamic>[boolStr, (value == true || value == 'true') ? 1 : 0],
      );
    }
    return (clause: '', params: <dynamic>[]);
  }

  static ({String clause, List<dynamic> params}) _selectClause(
    String jsonPath, FilterOperator op, dynamic value,
  ) {
    if (op == FilterOperator.equals) {
      // Select values may be stored as string or as {value, label} object
      // json_extract will return the raw JSON string
      return (clause: '($jsonPath = ? OR $jsonPath LIKE ?)',
              params: <dynamic>['$value', '%"value":"$value"%']);
    }
    return (clause: '', params: <dynamic>[]);
  }

  static num _toNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse('$v') ?? 0;
  }
}
