#!/usr/bin/env python3
"""Extrai do baseline as funcoes e triggers (o prisma migrate diff nao compara isso) e
escreve um SQL reaplicavel. Usa os cabecalhos do pg_dump ("-- Name: X; Type: FUNCTION"),
que trazem a assinatura exata. Uso: python3 gerar-funcoes-baseline.py > 2026-11_funcoes_baseline.sql"""
import re, sys, pathlib
base = pathlib.Path(__file__).resolve().parent.parent / 'migrations' / '00000000000000_baseline' / 'migration.sql'
sql = base.read_text()
HEADER = re.compile(r'^--\n-- Name: (?P<name>.+?); Type: (?P<type>[A-Z ]+); Schema: (?P<schema>[\w-]+);[^\n]*\n--\n', re.M)
parts = list(HEADER.finditer(sql))
funcs, trigs = [], []
for i, m in enumerate(parts):
    body = sql[m.end(): parts[i + 1].start() if i + 1 < len(parts) else len(sql)].strip()
    if m['type'] == 'FUNCTION':
        funcs.append(f"DROP FUNCTION IF EXISTS public.{m['name']} CASCADE;\n{body}")
    elif m['type'] == 'TRIGGER':
        table, trig = m['name'].split(' ', 1)  # cabecalho do pg_dump: "<tabela> <trigger>"
        trigs.append(f'DROP TRIGGER IF EXISTS {trig} ON public."{table}";\n{body}')
# Extensoes que as funcoes usam (o migrate diff tambem nao cria extensoes)
exts = [re.sub(r'CREATE EXTENSION (IF NOT EXISTS )?', 'CREATE EXTENSION IF NOT EXISTS ', e)
        for e in re.findall(r'^CREATE EXTENSION[^;]*;', sql, re.M)]
# Triggers antigos (fora do baseline) nas tabelas do sistema saem
keep = ', '.join(sorted({f"'{m['name'].split(' ', 1)[1]}'" for m in parts if m['type'] == 'TRIGGER'}))
drop_old = f'''DO $old$
DECLARE t record;
BEGIN
  FOR t IN SELECT tgname, tgrelid::regclass AS tbl FROM pg_trigger
           WHERE NOT tgisinternal AND tgname NOT IN ({keep}) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', t.tgname, t.tbl);
  END LOOP;
END $old$;'''
out = ['-- Gerado de 00000000000000_baseline por gerar-funcoes-baseline.py: funcoes e triggers do modelo novo.',
       '-- Reaplicavel. Rodar depois do alinhamento das tabelas (migrate diff) e antes do migrate resolve.',
       'BEGIN;', *exts, drop_old, *funcs, *trigs, 'COMMIT;']
sys.stdout.write('\n\n'.join(out) + '\n')
print(f'-- {len(funcs)} funcoes, {len(trigs)} triggers', file=sys.stderr)
