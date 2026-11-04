/** Preferencias de notificacao da pessoa (por empresa). O cargo continua como teto. */
export interface NotificationPrefs {
  events: { created: boolean; updated: boolean; deleted: boolean };
  /** Tabelas silenciadas (slug). */
  mutedEntities: string[];
  /** Avisar tambem sobre o que eu mesmo fiz. */
  ownActions: boolean;
  /** Mostrar avisos na tela (web). */
  popups: boolean;
  /** Notificacao push no celular para eventos de registro. */
  push: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  events: { created: true, updated: true, deleted: true },
  mutedEntities: [],
  ownActions: false,
  popups: true,
  push: false,
};

export function normalizePrefs(raw: unknown): NotificationPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotificationPrefs>;
  const ev = (r.events && typeof r.events === 'object' ? r.events : {}) as Partial<NotificationPrefs['events']>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    events: {
      created: bool(ev.created, true),
      updated: bool(ev.updated, true),
      deleted: bool(ev.deleted, true),
    },
    mutedEntities: Array.isArray(r.mutedEntities) ? r.mutedEntities.filter((s): s is string => typeof s === 'string').slice(0, 500) : [],
    ownActions: bool(r.ownActions, DEFAULT_NOTIFICATION_PREFS.ownActions),
    popups: bool(r.popups, DEFAULT_NOTIFICATION_PREFS.popups),
    push: bool(r.push, DEFAULT_NOTIFICATION_PREFS.push),
  };
}

/** Quem fez e quem criou o registro: tira o autor do aviso e respeita o escopo. */
export interface RecordEventContext {
  actorId?: string;
  creatorId?: string | null;
}
