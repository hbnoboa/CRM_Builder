import 'package:flutter/material.dart';

/// Badge widget for displaying HTTP methods (GET, POST, PUT, PATCH, DELETE).
/// Matches web-admin styling with appropriate colors.
class HttpMethodBadge extends StatelessWidget {
  const HttpMethodBadge({
    super.key,
    required this.method,
    this.size = HttpMethodBadgeSize.medium,
  });

  final String method;
  final HttpMethodBadgeSize size;

  @override
  Widget build(BuildContext context) {
    final config = _getMethodConfig(method);

    final double fontSize;
    final double horizontalPadding;
    final double verticalPadding;

    switch (size) {
      case HttpMethodBadgeSize.small:
        fontSize = 10;
        horizontalPadding = 6;
        verticalPadding = 2;
      case HttpMethodBadgeSize.medium:
        fontSize = 12;
        horizontalPadding = 8;
        verticalPadding = 4;
      case HttpMethodBadgeSize.large:
        fontSize = 14;
        horizontalPadding = 12;
        verticalPadding = 6;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: verticalPadding,
      ),
      decoration: BoxDecoration(
        color: config.backgroundColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        method.toUpperCase(),
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          color: config.textColor,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  _MethodConfig _getMethodConfig(String method) {
    switch (method.toUpperCase()) {
      case 'GET':
        return _MethodConfig(
          backgroundColor: Colors.teal.shade100,
          textColor: Colors.teal.shade700,
        );
      case 'POST':
        return _MethodConfig(
          backgroundColor: Colors.blue.shade100,
          textColor: Colors.blue.shade700,
        );
      case 'PUT':
        return _MethodConfig(
          backgroundColor: Colors.amber.shade100,
          textColor: Colors.amber.shade700,
        );
      case 'PATCH':
        return _MethodConfig(
          backgroundColor: Colors.orange.shade100,
          textColor: Colors.orange.shade700,
        );
      case 'DELETE':
        return _MethodConfig(
          backgroundColor: Colors.red.shade100,
          textColor: Colors.red.shade700,
        );
      default:
        return _MethodConfig(
          backgroundColor: Colors.grey.shade200,
          textColor: Colors.grey.shade700,
        );
    }
  }
}

class _MethodConfig {
  const _MethodConfig({
    required this.backgroundColor,
    required this.textColor,
  });

  final Color backgroundColor;
  final Color textColor;
}

enum HttpMethodBadgeSize { small, medium, large }
