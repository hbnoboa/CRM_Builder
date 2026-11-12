-- Tabelas criadas antes da correcao do plural automatico (nome ja no plural + "s"):
-- "Veículos" -> "Veículoss", "Não Conformidades" -> "Não Conformidadess".
-- So muda o plural que e exatamente o nome + "s" quando o nome ja termina em "s".
UPDATE "Entity"
SET "namePlural" = name
WHERE "namePlural" = name || 's'
  AND name ~* 's$';
