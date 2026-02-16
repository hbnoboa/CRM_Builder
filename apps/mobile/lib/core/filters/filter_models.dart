// Filter models for global (persisted) and local (session) filters.
// Mirrors the web-admin ActiveFilter interface.

enum FilterOperator {
  equals,
  contains,
  startsWith,
  endsWith,
  gt,
  gte,
  lt,
  lte,
  between,
  isEmpty,
  isNotEmpty;

  String toJson() => name;

  static FilterOperator fromJson(String json) {
    return FilterOperator.values.firstWhere(
      (e) => e.name == json,
      orElse: () => FilterOperator.equals,
    );
  }

  String get label {
    switch (this) {
      case FilterOperator.equals:
        return 'igual a';
      case FilterOperator.contains:
        return 'contem';
      case FilterOperator.startsWith:
        return 'comeca com';
      case FilterOperator.endsWith:
        return 'termina com';
      case FilterOperator.gt:
        return 'maior que';
      case FilterOperator.gte:
        return 'maior ou igual a';
      case FilterOperator.lt:
        return 'menor que';
      case FilterOperator.lte:
        return 'menor ou igual a';
      case FilterOperator.between:
        return 'entre';
      case FilterOperator.isEmpty:
        return 'esta vazio';
      case FilterOperator.isNotEmpty:
        return 'nao esta vazio';
    }
  }
}

/// Operators available per field type category.
List<FilterOperator> operatorsForFieldType(String fieldType) {
  final type = fieldType.toLowerCase();
  const textTypes = [
    'text', 'textarea', 'richtext', 'email', 'phone', 'url',
    'cpf', 'cnpj', 'cep', 'password',
  ];
  const numberTypes = [
    'number', 'currency', 'percentage', 'rating', 'slider',
  ];
  const dateTypes = ['date', 'datetime', 'time'];
  const selectTypes = ['select', 'multiselect', 'api-select', 'relation'];

  if (textTypes.contains(type)) {
    return [
      FilterOperator.contains,
      FilterOperator.equals,
      FilterOperator.startsWith,
      FilterOperator.endsWith,
      FilterOperator.isEmpty,
      FilterOperator.isNotEmpty,
    ];
  }
  if (numberTypes.contains(type)) {
    return [
      FilterOperator.equals,
      FilterOperator.gt,
      FilterOperator.gte,
      FilterOperator.lt,
      FilterOperator.lte,
      FilterOperator.between,
      FilterOperator.isEmpty,
      FilterOperator.isNotEmpty,
    ];
  }
  if (dateTypes.contains(type)) {
    return [
      FilterOperator.equals,
      FilterOperator.gt,
      FilterOperator.gte,
      FilterOperator.lt,
      FilterOperator.lte,
      FilterOperator.between,
      FilterOperator.isEmpty,
      FilterOperator.isNotEmpty,
    ];
  }
  if (type == 'boolean') {
    return [FilterOperator.equals];
  }
  if (selectTypes.contains(type)) {
    return [
      FilterOperator.equals,
      FilterOperator.isEmpty,
      FilterOperator.isNotEmpty,
    ];
  }
  return [FilterOperator.isEmpty, FilterOperator.isNotEmpty];
}

/// Global filter — persisted in Entity.settings.globalFilters,
/// synced via PowerSync to all devices.
class GlobalFilter {
  const GlobalFilter({
    required this.fieldSlug,
    required this.fieldName,
    required this.fieldType,
    required this.operator,
    this.value,
    this.value2,
    this.subField,
    this.createdBy,
    this.createdByName,
    this.createdAt,
  });

  factory GlobalFilter.fromJson(Map<String, dynamic> json) => GlobalFilter(
        fieldSlug: json['fieldSlug'] as String? ?? '',
        fieldName: json['fieldName'] as String? ?? '',
        fieldType: json['fieldType'] as String? ?? 'text',
        operator: FilterOperator.fromJson(json['operator'] as String? ?? 'equals'),
        value: json['value'],
        value2: json['value2'],
        subField: json['subField'] as String?,
        createdBy: json['createdBy'] as String?,
        createdByName: json['createdByName'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  final String fieldSlug;
  final String fieldName;
  final String fieldType;
  final FilterOperator operator;
  final dynamic value;
  final dynamic value2;
  final String? subField;
  final String? createdBy;
  final String? createdByName;
  final String? createdAt;

  Map<String, dynamic> toJson() => {
        'fieldSlug': fieldSlug,
        'fieldName': fieldName,
        'fieldType': fieldType,
        'operator': operator.toJson(),
        if (value != null) 'value': value,
        if (value2 != null) 'value2': value2,
        if (subField != null) 'subField': subField,
        if (createdBy != null) 'createdBy': createdBy,
        if (createdByName != null) 'createdByName': createdByName,
        if (createdAt != null) 'createdAt': createdAt,
      };

  String get displayLabel {
    if (operator == FilterOperator.isEmpty || operator == FilterOperator.isNotEmpty) {
      return '$fieldName: ${operator.label}';
    }
    if (operator == FilterOperator.between) {
      return '$fieldName: $value - $value2';
    }
    return '$fieldName ${operator.label} $value';
  }
}

/// Local filter — session-only, not persisted.
class LocalFilter {
  const LocalFilter({
    required this.id,
    required this.fieldSlug,
    required this.fieldName,
    required this.fieldType,
    required this.operator,
    this.value,
    this.value2,
  });

  final String id;
  final String fieldSlug;
  final String fieldName;
  final String fieldType;
  final FilterOperator operator;
  final dynamic value;
  final dynamic value2;

  String get displayLabel {
    if (operator == FilterOperator.isEmpty || operator == FilterOperator.isNotEmpty) {
      return '$fieldName: ${operator.label}';
    }
    if (operator == FilterOperator.between) {
      return '$fieldName: $value - $value2';
    }
    return '$fieldName ${operator.label} $value';
  }
}
