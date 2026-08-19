// Normalizacao de valores de select para o SAVE (espelha o `normalizeSelectValue`
// do web-admin). O widget (`_SelectFieldInput`) mantem o valor como {label,value}
// em memoria para exibir o rotulo no formulario; ao salvar, gravamos so o `value`
// (string) — igual ao web-form — para manter fidelidade de dado (filtros,
// dashboards, exports e busca "contains" ficam consistentes com a web).

/// Tipos de campo cujo valor e um select (guardam {value,label} ou lista deles).
const _selectTypes = <String>{
  'select',
  'multiselect',
  'api-select',
  'relation',
  'user-select',
  'radio-group',
  'workflow-status',
  'lookup',
};

/// {value,label} -> value; lista -> lista normalizada; senao inalterado.
dynamic _stripSelect(dynamic v) {
  if (v is Map && v.containsKey('value')) return v['value'];
  if (v is List) return v.map(_stripSelect).toList();
  return v;
}

/// Retorna uma copia de `values` com os campos do tipo select reduzidos ao
/// `value` puro. `fieldDefs` e a lista de definicoes de campo da entidade
/// (cada um com `slug` e `type`).
Map<String, dynamic> normalizeSelectValues(
  Map<String, dynamic> values,
  List<dynamic> fieldDefs,
) {
  final typeBySlug = <String, String>{};
  for (final f in fieldDefs) {
    if (f is Map) {
      final slug = f['slug'] as String?;
      final type = (f['type'] as String?)?.toLowerCase();
      if (slug != null && type != null) typeBySlug[slug] = type;
    }
  }
  final out = <String, dynamic>{};
  for (final e in values.entries) {
    final type = typeBySlug[e.key];
    out[e.key] =
        (type != null && _selectTypes.contains(type)) ? _stripSelect(e.value) : e.value;
  }
  return out;
}
