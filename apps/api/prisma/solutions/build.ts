/**
 * Monta as empresas-modelo pela API (mesmas regras, triggers e validacoes do uso real).
 *
 * Uso (de apps/api):
 *   SOLUTIONS_API=http://127.0.0.1:3901/api/v1 SOLUTIONS_PASSWORD=... \
 *     npx ts-node prisma/solutions/build.ts [slug ...]
 *
 * Cada modelo vira a empresa "<tenantName>" com o dono modelos+<slug>@iossystem.com.br.
 * Se a empresa ja tiver as tabelas do modelo, nada e refeito (rode num banco limpo ou
 * encerre a empresa antiga para remontar). Imprime o JSON { slug, tenantId, ownerEmail }.
 */
import { SOLUTIONS } from './index';
import type { DashboardSpec, EntitySpec, SampleRecord, SolutionSpec } from './types';

const API = (process.env.SOLUTIONS_API || 'http://127.0.0.1:3901/api/v1').replace(/\/$/, '');
const PASSWORD = process.env.SOLUTIONS_PASSWORD;
// Etiqueta opcional no e-mail do dono (rodadas de teste): modelos+<slug>-<tag>@...
const TAG = process.env.SOLUTIONS_TAG ? `-${process.env.SOLUTIONS_TAG}` : '';

type Json = Record<string, unknown>;

async function call<T = Json>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15_000)); // limite de tentativas por minuto
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

/** Filhas antes do pai (o campo sub-entity precisa do id da filha). */
async function createEntities(token: string, entities: EntitySpec[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const e of entities) {
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

async function createSamples(token: string, slug: string, records: SampleRecord[], parentRecordId?: string): Promise<number> {
  let count = 0;
  for (const r of records) {
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
  const existing = await call<{ data: Array<{ slug: string }> }>('GET', '/entities', token);
  if (existing.data.some((e) => spec.entities.some((s) => s.slug === e.slug))) {
    return { slug: spec.slug, tenantId, ownerEmail: email, skipped: 'ja montado' };
  }

  await call('PATCH', '/tenants/me', token, { brandColor: spec.brandColor, darkMode: 'light' });
  const entityIds = await createEntities(token, spec.entities);

  const roleIds = new Map<string, string>();
  for (const r of spec.roles) {
    const created = await call<{ id: string }>('POST', '/custom-roles', token, r);
    roleIds.set(r.name, created.id);
  }
  const roles = await call<{ data: Array<{ id: string; name: string }> }>('GET', '/custom-roles', token);
  for (const r of roles.data) if (!roleIds.has(r.name)) roleIds.set(r.name, r.id);

  let records = 0;
  for (const [slug, list] of Object.entries(spec.samples)) records += await createSamples(token, slug, list);

  for (const d of spec.dashboards) await call('POST', '/dashboard-templates', token, dashboardPayload(d, roleIds));

  for (const p of spec.pdfs) {
    const created = await call<{ id: string }>('POST', '/pdf-templates', token, {
      name: p.name, slug: p.slug, description: p.description, pageSize: 'A4', orientation: 'PORTRAIT',
      content: p.content, sourceEntityId: entityIds.get(p.entitySlug), templateType: p.templateType,
    });
    await call('POST', `/pdf-templates/${created.id}/publish`, token);
  }

  for (const c of spec.commands) await call('POST', '/chat/commands', token, { ...c, execMode: 'as_user', isActive: true });

  return {
    slug: spec.slug, tenantId, ownerEmail: email,
    entities: spec.entities.length, roles: spec.roles.length, records,
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
