/**
 * Monta as empresas-modelo pela API (mesmas regras, triggers e validacoes do uso real).
 *
 * Uso (de apps/api):
 *   SOLUTIONS_API=http://127.0.0.1:3901/api/v1 SOLUTIONS_PASSWORD=... \
 *     npx ts-node prisma/solutions/build.ts [slug ...]
 *
 * Cada modelo vira a empresa "<tenantName>" com o dono modelos+<slug>@iossystem.com.br.
 * Retomavel: o que ja existe (tabelas, cargos, registros raiz pelo campo-titulo, paineis,
 * PDFs, comandos) e mantido e so o que falta e criado. Com SOLUTIONS_SYNC_FIELDS=1, as regras
 * dos campos que ja existem (obrigatorio, padrao, ajuda) tambem sao alinhadas com o modelo. Respeita o limite do nginx
 * (~8 req/s e nova tentativa em 429/503). Imprime o JSON { slug, tenantId, ownerEmail }.
 */
import { SOLUTIONS } from './index';
import type { DashboardSpec, EntitySpec, SampleRecord, SolutionSpec } from './types';

const API = (process.env.SOLUTIONS_API || 'http://127.0.0.1:3901/api/v1').replace(/\/$/, '');
const PASSWORD = process.env.SOLUTIONS_PASSWORD;
// Etiqueta opcional no e-mail do dono (rodadas de teste): modelos+<slug>-<tag>@...
const TAG = process.env.SOLUTIONS_TAG ? `-${process.env.SOLUTIONS_TAG}` : '';
// Modelos ja montados: alinha obrigatorio/padrao/ajuda dos campos existentes com o codigo
const SYNC_FIELDS = process.env.SOLUTIONS_SYNC_FIELDS === '1';

type Json = Record<string, unknown>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T = Json>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(130); // abaixo do limite do nginx (10 req/s)
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      await sleep(res.status === 429 ? 15_000 : 3_000); // limite por minuto (API) ou por segundo (nginx)
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }
  throw new Error(`${method} ${path}: limite de tentativas`);
}

async function session(spec: SolutionSpec): Promise<{ token: string; tenantId: string; email: string }> {
  const email = `modelos+${spec.slug}${TAG}@iossystem.com.br`;
  try {
    const reg = await call<{ accessToken: string; user: { tenantId: string } }>('POST', '/auth/register', null, {
      name: 'Modelos IOS System', email, password: PASSWORD, tenantName: `${spec.tenantName}${TAG}`,
    });
    return { token: reg.accessToken, tenantId: reg.user.tenantId, email };
  } catch (error) {
    if (!String(error).includes('409')) throw error;
    const login = await call<{ accessToken: string; user: { tenantId: string } }>('POST', '/auth/login', null, { email, password: PASSWORD });
    return { token: login.accessToken, tenantId: login.user.tenantId, email };
  }
}

/**
 * Empresa-modelo ja montada: alinha so as regras dos campos que existem (obrigatorio,
 * valor padrao, texto de ajuda) com o modelo. Nao cria, nao apaga e nao mexe no resto.
 */
async function syncFieldRules(token: string, entityId: string, e: EntitySpec): Promise<void> {
  const current = await call<{ fields: Json[] }>('GET', `/entities/${entityId}`, token);
  const spec = new Map(e.fields.map((f) => [f.slug, f as unknown as Json]));
  let changed = 0;
  const fields = current.fields.filter((f) => !f.system).map((f) => {
    const want = spec.get(String(f.slug));
    if (!want) return f;
    const next: Json = { ...f };
    for (const key of ['required', 'default', 'helpText']) {
      if (want[key] === undefined) delete next[key];
      else next[key] = want[key];
    }
    if (JSON.stringify(next) !== JSON.stringify(f)) changed++;
    return next;
  });
  if (!changed) return;
  await call('PATCH', `/entities/${entityId}`, token, { fields });
  console.error(`  ${e.slug}: ${changed} campo(s) alinhado(s) com o modelo`);
}

/** Filhas antes do pai (o campo sub-entity precisa do id da filha). */
async function createEntities(token: string, entities: EntitySpec[], existing: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>(existing);
  for (const e of entities) {
    if (ids.has(e.slug)) {
      // ja criada numa rodada anterior; SOLUTIONS_SYNC_FIELDS=1 alinha obrigatorio/padrao/ajuda com o modelo
      if (SYNC_FIELDS) await syncFieldRules(token, ids.get(e.slug) as string, e);
      continue;
    }
    const fields = e.fields.map((f) => {
      const out: Json = { ...f };
      if (f.subEntitySlug) {
        const id = ids.get(f.subEntitySlug);
        if (!id) throw new Error(`${e.slug}.${f.slug}: crie ${f.subEntitySlug} antes`);
        out.subEntityId = id;
      }
      if (f.relatedEntitySlug) {
        const id = ids.get(f.relatedEntitySlug);
        if (!id) throw new Error(`${e.slug}.${f.slug}: crie ${f.relatedEntitySlug} antes`);
        out.relatedEntityId = id;
      }
      return out;
    });
    const created = await call<{ id: string }>('POST', '/entities', token, {
      name: e.name, namePlural: e.namePlural, slug: e.slug, description: e.description,
      icon: e.icon, color: e.color, category: e.category, fields, settings: e.settings ?? {},
    });
    ids.set(e.slug, created.id);
  }
  return ids;
}

async function createSamples(token: string, slug: string, records: SampleRecord[], parentRecordId?: string, skipTitles?: Set<string>, titleField?: string): Promise<number> {
  let count = 0;
  for (const r of records) {
    // Retomada: registro raiz que ja existe (mesmo valor no campo-titulo) fica como esta
    if (skipTitles && titleField && skipTitles.has(String(r.data[titleField]))) continue;
    const created = await call<{ id: string }>('POST', `/data/${slug}`, token, { data: r.data, ...(parentRecordId ? { parentRecordId } : {}) });
    count++;
    for (const [childSlug, children] of Object.entries(r.children ?? {})) {
      count += await createSamples(token, childSlug, children, created.id);
    }
  }
  return count;
}

function dashboardPayload(d: DashboardSpec, roleIds: Map<string, string>): Json {
  const layout: Json[] = [];
  const widgets: Record<string, Json> = {};
  for (const tab of d.tabs) {
    let y = 0;
    for (const row of tab.rows) {
      let x = 0;
      const h = Math.max(...row.map((w) => w.h));
      for (const w of row) {
        layout.push({ i: w.id, x, y, w: w.w, h: w.h, minW: 2, minH: 2 });
        widgets[w.id] = { type: w.type, title: w.title, config: w.config };
        x += w.w;
      }
      y += h;
    }
  }
  const ids = d.roles.map((name) => {
    const id = roleIds.get(name);
    if (!id) throw new Error(`painel "${d.name}": cargo "${name}" nao existe`);
    return id;
  });
  return {
    name: d.name, description: d.description, entitySlug: d.entitySlug, priority: d.priority ?? 10,
    layout, widgets, roleIds: ids,
    tabs: d.tabs.map((t) => ({ id: t.id, label: t.label, widgetIds: t.rows.flat().map((w) => w.id) })),
  };
}

async function build(spec: SolutionSpec): Promise<Json> {
  const { token, tenantId, email } = await session(spec);
  const existingEntities = await call<{ data: Array<{ id: string; slug: string }> }>('GET', '/entities', token);
  const existingIds = new Map(existingEntities.data.filter((e) => spec.entities.some((s) => s.slug === e.slug)).map((e) => [e.slug, e.id]));
  if (existingIds.size === 0) await call('PATCH', '/tenants/me', token, { brandColor: spec.brandColor, darkMode: 'light' });
  const entityIds = await createEntities(token, spec.entities, existingIds);

  const roles = await call<{ data: Array<{ id: string; name: string }> }>('GET', '/custom-roles', token);
  const roleIds = new Map(roles.data.map((r) => [r.name, r.id]));
  for (const r of spec.roles) {
    if (roleIds.has(r.name)) continue;
    const created = await call<{ id: string }>('POST', '/custom-roles', token, r);
    roleIds.set(r.name, created.id);
  }

  let records = 0;
  for (const [slug, list] of Object.entries(spec.samples)) {
    const titleField = (spec.entities.find((e) => e.slug === slug)?.settings?.titleField as string | undefined) ?? undefined;
    const present = new Set<string>();
    if (titleField) {
      const rows = await call<{ data: Array<{ data: Record<string, unknown> }> }>('GET', `/data/${slug}?limit=1000`, token);
      for (const row of rows.data) present.add(String(row.data[titleField]));
    }
    records += await createSamples(token, slug, list, undefined, present, titleField);
  }

  const dashboards = await call<Json[] | { data: Json[] }>('GET', '/dashboard-templates', token);
  const dashNames = new Set((Array.isArray(dashboards) ? dashboards : dashboards.data).map((d) => String(d.name)));
  for (const d of spec.dashboards) {
    if (!dashNames.has(d.name)) await call('POST', '/dashboard-templates', token, dashboardPayload(d, roleIds));
  }

  const pdfs = await call<Json[] | { data: Json[] }>('GET', '/pdf-templates', token);
  const pdfSlugs = new Set((Array.isArray(pdfs) ? pdfs : pdfs.data).map((t) => String(t.slug)));
  for (const p of spec.pdfs) {
    if (pdfSlugs.has(p.slug)) continue;
    const created = await call<{ id: string }>('POST', '/pdf-templates', token, {
      name: p.name, slug: p.slug, description: p.description, pageSize: 'A4', orientation: 'PORTRAIT',
      content: p.content, sourceEntityId: entityIds.get(p.entitySlug), templateType: p.templateType,
    });
    await call('POST', `/pdf-templates/${created.id}/publish`, token);
  }

  const commands = await call<Json[] | { data: Json[] }>('GET', '/chat/commands/manage', token);
  const commandSlugs = new Set((Array.isArray(commands) ? commands : commands.data).map((c) => String(c.slug).replace(/^\//, '')));
  for (const c of spec.commands) {
    if (!commandSlugs.has(c.slug)) await call('POST', '/chat/commands', token, { ...c, execMode: 'as_user', isActive: true });
  }

  return {
    slug: spec.slug, tenantId, ownerEmail: email, resumed: existingIds.size > 0,
    entities: spec.entities.length, roles: spec.roles.length, newRecords: records,
    dashboards: spec.dashboards.length, pdfs: spec.pdfs.length, commands: spec.commands.length,
  };
}

async function main(): Promise<void> {
  if (!PASSWORD) throw new Error('Defina SOLUTIONS_PASSWORD');
  const wanted = process.argv.slice(2);
  const specs = wanted.length ? SOLUTIONS.filter((s) => wanted.includes(s.slug)) : SOLUTIONS;
  if (wanted.length && specs.length !== wanted.length) throw new Error(`Modelos: ${SOLUTIONS.map((s) => s.slug).join(', ')}`);
  const out: Json[] = [];
  for (const spec of specs) out.push(await build(spec));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
