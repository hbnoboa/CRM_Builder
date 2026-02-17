import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// View modes for data list display
enum DataViewMode { list, grid, compact }

/// Provider for managing view mode state
final dataViewModeProvider = StateProvider<DataViewMode>((ref) {
  return DataViewMode.list;
});

/// Toggle button widget for switching view modes
class ViewModeToggle extends ConsumerWidget {
  const ViewModeToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(dataViewModeProvider);

    return SegmentedButton<DataViewMode>(
      segments: const [
        ButtonSegment(
          value: DataViewMode.list,
          icon: Icon(Icons.view_list, size: 18),
          tooltip: 'Lista',
        ),
        ButtonSegment(
          value: DataViewMode.grid,
          icon: Icon(Icons.grid_view, size: 18),
          tooltip: 'Grid',
        ),
        ButtonSegment(
          value: DataViewMode.compact,
          icon: Icon(Icons.view_headline, size: 18),
          tooltip: 'Compacto',
        ),
      ],
      selected: {mode},
      onSelectionChanged: (values) {
        ref.read(dataViewModeProvider.notifier).state = values.first;
      },
      showSelectedIcon: false,
    );
  }
}
