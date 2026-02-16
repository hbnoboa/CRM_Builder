import 'package:flutter/material.dart';

/// Maps entity icon string names (Lucide-style) to Material Icons.
/// Falls back to [Icons.folder_outlined] if no match found.
class IconMapper {
  IconMapper._();

  static IconData fromString(String? iconName) {
    if (iconName == null || iconName.isEmpty) return Icons.folder_outlined;
    return _map[iconName.toLowerCase()] ?? Icons.folder_outlined;
  }

  static const Map<String, IconData> _map = {
    // People
    'users': Icons.people_outlined,
    'user': Icons.person_outlined,
    'user-check': Icons.person_add_alt_1_outlined,
    'user-plus': Icons.person_add_outlined,
    'contact': Icons.contacts_outlined,

    // Business
    'building': Icons.business_outlined,
    'building-2': Icons.apartment_outlined,
    'briefcase': Icons.work_outlined,
    'landmark': Icons.account_balance_outlined,
    'store': Icons.store_outlined,
    'shopping-cart': Icons.shopping_cart_outlined,
    'shopping-bag': Icons.shopping_bag_outlined,
    'credit-card': Icons.credit_card_outlined,
    'dollar-sign': Icons.attach_money,
    'banknote': Icons.payments_outlined,
    'receipt': Icons.receipt_outlined,
    'wallet': Icons.wallet_outlined,

    // Documents
    'file': Icons.insert_drive_file_outlined,
    'file-text': Icons.description_outlined,
    'files': Icons.folder_copy_outlined,
    'clipboard': Icons.assignment_outlined,
    'clipboard-list': Icons.fact_check_outlined,
    'notebook': Icons.menu_book_outlined,
    'book': Icons.book_outlined,
    'book-open': Icons.auto_stories_outlined,

    // Communication
    'mail': Icons.email_outlined,
    'phone': Icons.phone_outlined,
    'message-circle': Icons.chat_bubble_outline,
    'message-square': Icons.message_outlined,
    'send': Icons.send_outlined,
    'megaphone': Icons.campaign_outlined,
    'bell': Icons.notifications_outlined,

    // Tools / Actions
    'settings': Icons.settings_outlined,
    'wrench': Icons.build_outlined,
    'tool': Icons.handyman_outlined,
    'hammer': Icons.gavel_outlined,
    'cog': Icons.settings_outlined,

    // Navigation / Location
    'map': Icons.map_outlined,
    'map-pin': Icons.location_on_outlined,
    'navigation': Icons.explore_outlined,
    'globe': Icons.language,
    'home': Icons.home_outlined,
    'compass': Icons.explore_outlined,

    // Data / Analytics
    'bar-chart': Icons.bar_chart,
    'bar-chart-2': Icons.assessment_outlined,
    'pie-chart': Icons.pie_chart_outline,
    'trending-up': Icons.trending_up,
    'activity': Icons.show_chart,
    'database': Icons.storage_outlined,
    'server': Icons.dns_outlined,

    // Time
    'calendar': Icons.calendar_today_outlined,
    'calendar-days': Icons.calendar_month_outlined,
    'clock': Icons.access_time,
    'timer': Icons.timer_outlined,
    'history': Icons.history,

    // Media
    'image': Icons.image_outlined,
    'camera': Icons.camera_alt_outlined,
    'video': Icons.videocam_outlined,
    'music': Icons.music_note_outlined,
    'headphones': Icons.headphones_outlined,

    // Objects
    'package': Icons.inventory_2_outlined,
    'box': Icons.inbox_outlined,
    'archive': Icons.archive_outlined,
    'truck': Icons.local_shipping_outlined,
    'car': Icons.directions_car_outlined,
    'plane': Icons.flight_outlined,

    // Status
    'check': Icons.check,
    'check-circle': Icons.check_circle_outlined,
    'x-circle': Icons.cancel_outlined,
    'alert-circle': Icons.error_outline,
    'alert-triangle': Icons.warning_amber_outlined,
    'info': Icons.info_outlined,
    'help-circle': Icons.help_outline,

    // Shapes / Symbols
    'star': Icons.star_outlined,
    'heart': Icons.favorite_outline,
    'flag': Icons.flag_outlined,
    'tag': Icons.label_outlined,
    'tags': Icons.sell_outlined,
    'bookmark': Icons.bookmark_outline,
    'award': Icons.emoji_events_outlined,
    'trophy': Icons.emoji_events_outlined,
    'target': Icons.gps_fixed,
    'zap': Icons.bolt,
    'flame': Icons.local_fire_department_outlined,

    // Tech
    'code': Icons.code,
    'terminal': Icons.terminal,
    'cpu': Icons.memory,
    'wifi': Icons.wifi,
    'bluetooth': Icons.bluetooth,
    'link': Icons.link,
    'key': Icons.key_outlined,
    'lock': Icons.lock_outlined,
    'shield': Icons.shield_outlined,
    'eye': Icons.visibility_outlined,

    // Nature
    'leaf': Icons.eco_outlined,
    'tree': Icons.park_outlined,
    'sun': Icons.wb_sunny_outlined,
    'moon': Icons.dark_mode_outlined,
    'cloud': Icons.cloud_outlined,
    'droplet': Icons.water_drop_outlined,

    // Misc
    'folder': Icons.folder_outlined,
    'grid': Icons.grid_view,
    'list': Icons.list,
    'layers': Icons.layers_outlined,
    'layout': Icons.dashboard_outlined,
    'puzzle': Icons.extension_outlined,
    'lightbulb': Icons.lightbulb_outlined,
    'rocket': Icons.rocket_launch_outlined,
    'gift': Icons.card_giftcard_outlined,
    'graduation-cap': Icons.school_outlined,
    'stethoscope': Icons.medical_services_outlined,
    'pill': Icons.medication_outlined,
    'scissors': Icons.content_cut,
    'pen': Icons.edit_outlined,
    'pencil': Icons.edit_outlined,
    'trash': Icons.delete_outlined,
    'search': Icons.search,
    'filter': Icons.filter_list,
    'download': Icons.download_outlined,
    'upload': Icons.upload_outlined,
    'share': Icons.share_outlined,
    'printer': Icons.print_outlined,
    'qr-code': Icons.qr_code,
  };
}
