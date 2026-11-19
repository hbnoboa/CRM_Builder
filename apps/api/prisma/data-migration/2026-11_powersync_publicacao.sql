-- Publicacao "powersync" com as mesmas tabelas do baseline (00000000000000_baseline).
-- Prod recebeu o baseline marcado como aplicado (migrate resolve), entao a publicacao
-- ficou com as tabelas antigas: sem Message/Channel o chat nao chega ao app, e sem
-- EntityDataMasked o cargo com campo oculto sincroniza vazio. So acrescenta o que falta;
-- reaplicavel. Depois de rodar, reiniciar o PowerSync para ele ler a publicacao e as regras.
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['ArchivedEntityData', 'Channel', 'ChannelMember', 'CommandTemplate', 'CustomRole',
    'Entity', 'EntityData', 'EntityDataMasked', 'EntityFieldRule', 'Message', 'Notification', 'TeamAccessKey', 'User'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    CREATE PUBLICATION powersync WITH (publish = 'insert, update, delete, truncate');
  END IF;
  IF (SELECT puballtables FROM pg_publication WHERE pubname = 'powersync') THEN
    RETURN; -- publica todas as tabelas: nada a fazer
  END IF;
  FOREACH t IN ARRAY tabelas LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION powersync ADD TABLE ONLY public.%I', t);
      RAISE NOTICE 'publicacao powersync: + %', t;
    END IF;
  END LOOP;
END $$;

SELECT string_agg(tablename, ', ' ORDER BY tablename) AS tabelas_publicadas
  FROM pg_publication_tables WHERE pubname = 'powersync';
