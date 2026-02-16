import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/filters/filter_models.dart';

part 'filter_provider.g.dart';

/// Manages local (session-only) filters per entity.
/// These filters are NOT persisted and reset when the app restarts.
@riverpod
class EntityLocalFilters extends _$EntityLocalFilters {
  @override
  Map<String, List<LocalFilter>> build() => {};

  void addFilter(String entitySlug, LocalFilter filter) {
    final current = state[entitySlug] ?? [];
    state = {
      ...state,
      entitySlug: [...current, filter],
    };
  }

  void removeFilter(String entitySlug, String filterId) {
    final current = state[entitySlug] ?? [];
    state = {
      ...state,
      entitySlug: current.where((f) => f.id != filterId).toList(),
    };
  }

  void clearFilters(String entitySlug) {
    final newState = Map<String, List<LocalFilter>>.from(state);
    newState.remove(entitySlug);
    state = newState;
  }

  List<LocalFilter> getFilters(String entitySlug) {
    return state[entitySlug] ?? [];
  }
}
