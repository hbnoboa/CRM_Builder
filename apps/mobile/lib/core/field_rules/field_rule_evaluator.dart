import 'dart:convert';
import 'package:crm_mobile/core/database/app_database.dart';

/// Field rule types matching backend enum
enum FieldRuleType {
  required,
  visible,
  defaultValue, // 'default' is reserved word
  computed,
  validation,
}

/// Condition operators for field rules
enum ConditionOperator {
  eq,
  neq,
  contains,
  notContains,
  gt,
  gte,
  lt,
  lte,
  isIn,
  notIn,
  isEmpty,
  isNotEmpty,
}

/// A single field rule from EntityFieldRule table
class FieldRule {
  final String id;
  final String entityId;
  final String fieldSlug;
  final FieldRuleType ruleType;
  final Map<String, dynamic>? condition;
  final Map<String, dynamic> config;
  final int priority;
  final bool isActive;

  FieldRule({
    required this.id,
    required this.entityId,
    required this.fieldSlug,
    required this.ruleType,
    this.condition,
    required this.config,
    required this.priority,
    required this.isActive,
  });

  factory FieldRule.fromMap(Map<String, dynamic> map) {
    return FieldRule(
      id: map['id'] as String,
      entityId: map['entityId'] as String,
      fieldSlug: map['fieldSlug'] as String,
      ruleType: _parseRuleType(map['ruleType'] as String),
      condition: _parseJson(map['condition']),
      config: _parseJson(map['config']) ?? {},
      priority: map['priority'] as int? ?? 0,
      isActive: map['isActive'] == 1 || map['isActive'] == true,
    );
  }

  static FieldRuleType _parseRuleType(String type) {
    switch (type) {
      case 'required':
        return FieldRuleType.required;
      case 'visible':
        return FieldRuleType.visible;
      case 'default':
        return FieldRuleType.defaultValue;
      case 'computed':
        return FieldRuleType.computed;
      case 'validation':
        return FieldRuleType.validation;
      default:
        return FieldRuleType.required;
    }
  }

  static Map<String, dynamic>? _parseJson(dynamic value) {
    if (value == null) return null;
    if (value is Map<String, dynamic>) return value;
    if (value is String) {
      try {
        return jsonDecode(value) as Map<String, dynamic>?;
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/// Evaluates field rules against form data
class FieldRuleEvaluator {
  final List<FieldRule> _rules;

  FieldRuleEvaluator(this._rules);

  /// Load rules for an entity from the local database
  static Future<FieldRuleEvaluator> loadForEntity(String entityId) async {
    final db = AppDatabase.instance.db;
    final rows = await db.getAll(
      'SELECT * FROM EntityFieldRule WHERE entityId = ? AND isActive = 1 ORDER BY priority DESC',
      [entityId],
    );
    final rules = rows.map((r) => FieldRule.fromMap(r)).toList();
    return FieldRuleEvaluator(rules);
  }

  /// Get rules for a specific field
  List<FieldRule> getRulesForField(String fieldSlug) {
    return _rules.where((r) => r.fieldSlug == fieldSlug).toList();
  }

  /// Check if a field is required based on current form data
  bool isFieldRequired(String fieldSlug, Map<String, dynamic> formData) {
    final rules = getRulesForField(fieldSlug)
        .where((r) => r.ruleType == FieldRuleType.required)
        .toList();

    if (rules.isEmpty) return false;

    for (final rule in rules) {
      if (rule.condition == null) {
        // Rule without condition - always required
        return true;
      }
      if (_evaluateCondition(rule.condition!, formData)) {
        return true;
      }
    }
    return false;
  }

  /// Check if a field is visible based on current form data
  bool isFieldVisible(String fieldSlug, Map<String, dynamic> formData) {
    final rules = getRulesForField(fieldSlug)
        .where((r) => r.ruleType == FieldRuleType.visible)
        .toList();

    if (rules.isEmpty) return true; // Visible by default

    for (final rule in rules) {
      if (rule.condition == null) {
        // Rule without condition - check config for visibility
        return rule.config['visible'] == true;
      }
      if (_evaluateCondition(rule.condition!, formData)) {
        return rule.config['visible'] != false;
      }
    }
    return true;
  }

  /// Get default value for a field based on current form data
  dynamic getDefaultValue(String fieldSlug, Map<String, dynamic> formData) {
    final rules = getRulesForField(fieldSlug)
        .where((r) => r.ruleType == FieldRuleType.defaultValue)
        .toList();

    if (rules.isEmpty) return null;

    for (final rule in rules) {
      if (rule.condition == null) {
        return rule.config['value'];
      }
      if (_evaluateCondition(rule.condition!, formData)) {
        return rule.config['value'];
      }
    }
    return null;
  }

  /// Get computed value for a field based on current form data
  dynamic getComputedValue(String fieldSlug, Map<String, dynamic> formData) {
    final rules = getRulesForField(fieldSlug)
        .where((r) => r.ruleType == FieldRuleType.computed)
        .toList();

    if (rules.isEmpty) return null;

    for (final rule in rules) {
      if (rule.condition != null && !_evaluateCondition(rule.condition!, formData)) {
        continue;
      }

      final expression = rule.config['expression'] as String?;
      if (expression == null) continue;

      return _evaluateExpression(expression, formData);
    }
    return null;
  }

  /// Validate a field value based on custom validation rules
  String? validateField(String fieldSlug, dynamic value, Map<String, dynamic> formData) {
    final rules = getRulesForField(fieldSlug)
        .where((r) => r.ruleType == FieldRuleType.validation)
        .toList();

    if (rules.isEmpty) return null;

    for (final rule in rules) {
      if (rule.condition != null && !_evaluateCondition(rule.condition!, formData)) {
        continue;
      }

      final validationType = rule.config['type'] as String?;
      final errorMessage = rule.config['message'] as String? ?? 'Valor invalido';

      switch (validationType) {
        case 'regex':
          final pattern = rule.config['pattern'] as String?;
          if (pattern != null && value is String) {
            final regex = RegExp(pattern);
            if (!regex.hasMatch(value)) {
              return errorMessage;
            }
          }
          break;
        case 'min':
          final min = rule.config['min'];
          if (min != null && value != null) {
            final numValue = value is num ? value : num.tryParse(value.toString());
            if (numValue != null && numValue < min) {
              return errorMessage;
            }
          }
          break;
        case 'max':
          final max = rule.config['max'];
          if (max != null && value != null) {
            final numValue = value is num ? value : num.tryParse(value.toString());
            if (numValue != null && numValue > max) {
              return errorMessage;
            }
          }
          break;
        case 'minLength':
          final minLen = rule.config['minLength'] as int?;
          if (minLen != null && value is String && value.length < minLen) {
            return errorMessage;
          }
          break;
        case 'maxLength':
          final maxLen = rule.config['maxLength'] as int?;
          if (maxLen != null && value is String && value.length > maxLen) {
            return errorMessage;
          }
          break;
      }
    }
    return null;
  }

  /// Evaluate a condition against form data
  bool _evaluateCondition(Map<String, dynamic> condition, Map<String, dynamic> formData) {
    final field = condition['field'] as String?;
    final operator = condition['operator'] as String?;
    final expectedValue = condition['value'];

    if (field == null || operator == null) return false;

    final actualValue = formData[field];

    switch (operator) {
      case 'eq':
        return _equals(actualValue, expectedValue);
      case 'neq':
        return !_equals(actualValue, expectedValue);
      case 'contains':
        return actualValue?.toString().contains(expectedValue?.toString() ?? '') ?? false;
      case 'not_contains':
        return !(actualValue?.toString().contains(expectedValue?.toString() ?? '') ?? false);
      case 'gt':
        return _compare(actualValue, expectedValue) > 0;
      case 'gte':
        return _compare(actualValue, expectedValue) >= 0;
      case 'lt':
        return _compare(actualValue, expectedValue) < 0;
      case 'lte':
        return _compare(actualValue, expectedValue) <= 0;
      case 'in':
        if (expectedValue is List) {
          return expectedValue.any((v) => _equals(actualValue, v));
        }
        return false;
      case 'not_in':
        if (expectedValue is List) {
          return !expectedValue.any((v) => _equals(actualValue, v));
        }
        return true;
      case 'is_empty':
        return actualValue == null || actualValue.toString().isEmpty;
      case 'is_not_empty':
        return actualValue != null && actualValue.toString().isNotEmpty;
      default:
        return false;
    }
  }

  bool _equals(dynamic a, dynamic b) {
    if (a == b) return true;
    if (a == null || b == null) return false;
    return a.toString() == b.toString();
  }

  int _compare(dynamic a, dynamic b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    final numA = a is num ? a : num.tryParse(a.toString());
    final numB = b is num ? b : num.tryParse(b.toString());

    if (numA != null && numB != null) {
      return numA.compareTo(numB);
    }
    return a.toString().compareTo(b.toString());
  }

  /// Evaluate a simple expression like "{{price}} * {{quantity}}"
  dynamic _evaluateExpression(String expression, Map<String, dynamic> formData) {
    // Replace field references with values
    var result = expression;
    final fieldPattern = RegExp(r'\{\{(\w+)\}\}');

    final matches = fieldPattern.allMatches(expression);
    for (final match in matches) {
      final fieldName = match.group(1);
      if (fieldName != null) {
        final value = formData[fieldName];
        result = result.replaceAll('{{$fieldName}}', value?.toString() ?? '0');
      }
    }

    // Try to evaluate as math expression
    try {
      // Simple arithmetic evaluation (supports + - * /)
      final cleanExpr = result.replaceAll(' ', '');
      if (RegExp(r'^[\d.+\-*/()]+$').hasMatch(cleanExpr)) {
        return _evaluateMath(cleanExpr);
      }
    } catch (_) {}

    return result;
  }

  /// Simple math expression evaluator
  double? _evaluateMath(String expr) {
    try {
      // Handle parentheses recursively
      while (expr.contains('(')) {
        final start = expr.lastIndexOf('(');
        final end = expr.indexOf(')', start);
        if (end == -1) return null;
        final inner = expr.substring(start + 1, end);
        final innerResult = _evaluateMath(inner);
        if (innerResult == null) return null;
        expr = expr.substring(0, start) + innerResult.toString() + expr.substring(end + 1);
      }

      // Handle * and / first
      while (expr.contains('*') || RegExp(r'[^+\-]/').hasMatch(expr)) {
        final mulMatch = RegExp(r'(\d+\.?\d*)\*(\d+\.?\d*)').firstMatch(expr);
        final divMatch = RegExp(r'(\d+\.?\d*)/(\d+\.?\d*)').firstMatch(expr);

        if (mulMatch != null && (divMatch == null || mulMatch.start < divMatch.start)) {
          final a = double.parse(mulMatch.group(1)!);
          final b = double.parse(mulMatch.group(2)!);
          expr = expr.replaceFirst(mulMatch.group(0)!, (a * b).toString());
        } else if (divMatch != null) {
          final a = double.parse(divMatch.group(1)!);
          final b = double.parse(divMatch.group(2)!);
          expr = expr.replaceFirst(divMatch.group(0)!, (a / b).toString());
        } else {
          break;
        }
      }

      // Handle + and -
      final parts = <double>[];
      final numPattern = RegExp(r'[+\-]?\d+\.?\d*');
      var pos = 0;

      for (final match in numPattern.allMatches(expr)) {
        if (match.start > pos && expr[match.start - 1] == '-') {
          parts.add(-double.parse(match.group(0)!.replaceFirst('-', '')));
        } else {
          parts.add(double.parse(match.group(0)!));
        }
        pos = match.end;
      }

      if (parts.isEmpty) return null;
      return parts.reduce((a, b) => a + b);
    } catch (_) {
      return null;
    }
  }
}
