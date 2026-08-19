import 'package:flutter_test/flutter_test.dart';
import 'package:crm_mobile/shared/utils/select_normalize.dart';

void main() {
  final fields = [
    {'slug': 'tipo', 'type': 'select'},
    {'slug': 'tags', 'type': 'multiselect'},
    {'slug': 'responsavel', 'type': 'api-select'},
    {'slug': 'chassi', 'type': 'text'},
    {'slug': 'foto', 'type': 'image'},
    {'slug': 'concluido', 'type': 'boolean'},
  ];

  test('select {label,value} -> value (string)', () {
    final out = normalizeSelectValues({
      'tipo': {'label': 'Colisão', 'value': 'Colisão'},
    }, fields);
    expect(out['tipo'], 'Colisão');
  });

  test('multiselect: lista de {label,value} -> lista de values', () {
    final out = normalizeSelectValues({
      'tags': [
        {'label': 'A', 'value': 'a'},
        {'label': 'B', 'value': 'b'},
      ],
    }, fields);
    expect(out['tags'], ['a', 'b']);
  });

  test('api-select objeto -> value (id)', () {
    final out = normalizeSelectValues({
      'responsavel': {'label': 'João', 'value': 'usr_1', 'data': {}},
    }, fields);
    expect(out['responsavel'], 'usr_1');
  });

  test('NAO mexe em text/image/boolean nem em valores ja normalizados', () {
    final out = normalizeSelectValues({
      'chassi': 'ABC123',
      'foto': 'https://x/y.jpg',
      'concluido': false,
      'tipo': 'Colisão', // ja string
    }, fields);
    expect(out['chassi'], 'ABC123');
    expect(out['foto'], 'https://x/y.jpg');
    expect(out['concluido'], false);
    expect(out['tipo'], 'Colisão');
  });

  test('campo sem def fica inalterado', () {
    final out = normalizeSelectValues({
      'desconhecido': {'label': 'X', 'value': 'x'},
    }, fields);
    expect(out['desconhecido'], {'label': 'X', 'value': 'x'});
  });
}
