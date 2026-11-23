import { column, Schema, Table } from '@powersync/web';

/**
 * Banco local do modo sem internet (mesmas tabelas e colunas que o app do celular
 * recebe pelas regras de sincronizacao em apps/mobile/powersync.yaml). So o que a tela
 * de campo usa; o resto que chegar fica guardado pelo SDK sem tabela.
 * Cargo com campo oculto recebe a copia sem esses campos (EntityDataMasked AS EntityData).
 */
const Entity = new Table({
  tenantId: column.text,
  name: column.text,
  namePlural: column.text,
  slug: column.text,
  description: column.text,
  icon: column.text,
  color: column.text,
  category: column.text,
  fields: column.text,
  settings: column.text,
  isSystem: column.integer,
  createdAt: column.text,
  updatedAt: column.text,
});

const EntityData = new Table(
  {
    tenantId: column.text,
    entityId: column.text,
    data: column.text,
    parentRecordId: column.text,
    createdById: column.text,
    updatedById: column.text,
    createdAt: column.text,
    updatedAt: column.text,
    deletedAt: column.text,
  },
  { indexes: { entity: ['entityId', 'createdAt'] } },
);

const CustomRole = new Table({
  tenantId: column.text,
  name: column.text,
  permissions: column.text,
  modulePermissions: column.text,
  createdAt: column.text,
  updatedAt: column.text,
});

export const OfflineSchema = new Schema({ Entity, EntityData, CustomRole });

export type OfflineDatabase = (typeof OfflineSchema)['types'];
export type EntityRow = OfflineDatabase['Entity'];
export type EntityDataRow = OfflineDatabase['EntityData'];
