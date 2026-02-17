import 'package:flutter/material.dart';

/// Badge widget for displaying status (ACTIVE, INACTIVE, PENDING, SUSPENDED).
/// Matches web-admin styling with appropriate colors.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.status,
    this.label,
    this.size = StatusBadgeSize.medium,
  });

  final String status;
  final String? label;
  final StatusBadgeSize size;

  @override
  Widget build(BuildContext context) {
    final config = _getStatusConfig(status);
    final displayLabel = label ?? _getDefaultLabel(status);

    final double fontSize;
    final double horizontalPadding;
    final double verticalPadding;

    switch (size) {
      case StatusBadgeSize.small:
        fontSize = 10;
        horizontalPadding = 6;
        verticalPadding = 2;
      case StatusBadgeSize.medium:
        fontSize = 12;
        horizontalPadding = 8;
        verticalPadding = 4;
      case StatusBadgeSize.large:
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (config.icon != null) ...[
            Icon(
              config.icon,
              size: fontSize,
              color: config.textColor,
            ),
            SizedBox(width: fontSize / 3),
          ],
          Text(
            displayLabel,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w500,
              color: config.textColor,
            ),
          ),
        ],
      ),
    );
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return _StatusConfig(
          backgroundColor: Colors.green.shade100,
          textColor: Colors.green.shade700,
          icon: Icons.check_circle_outline,
        );
      case 'INACTIVE':
        return _StatusConfig(
          backgroundColor: Colors.grey.shade200,
          textColor: Colors.grey.shade700,
          icon: Icons.remove_circle_outline,
        );
      case 'PENDING':
        return _StatusConfig(
          backgroundColor: Colors.amber.shade100,
          textColor: Colors.amber.shade700,
          icon: Icons.schedule,
        );
      case 'SUSPENDED':
        return _StatusConfig(
          backgroundColor: Colors.red.shade100,
          textColor: Colors.red.shade700,
          icon: Icons.block,
        );
      default:
        return _StatusConfig(
          backgroundColor: Colors.grey.shade200,
          textColor: Colors.grey.shade700,
        );
    }
  }

  String _getDefaultLabel(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'Ativo';
      case 'INACTIVE':
        return 'Inativo';
      case 'PENDING':
        return 'Pendente';
      case 'SUSPENDED':
        return 'Suspenso';
      default:
        return status;
    }
  }
}

class _StatusConfig {
  const _StatusConfig({
    required this.backgroundColor,
    required this.textColor,
    this.icon,
  });

  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;
}

enum StatusBadgeSize { small, medium, large }
