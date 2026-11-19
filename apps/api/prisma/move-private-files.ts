/**
 * Leva para o armazenamento privado os arquivos que antes ficavam num endereco publico:
 * anexos e relatorios do chat, PDFs gerados (historico), arquivamento de registros e
 * auditoria antiga. Reescreve as mensagens (attachments[].url -> key, url -> fileKey) e o
 * historico de PDFs (fileUrl -> private:<chave>). Reaplicavel: o que ja foi movido fica.
 *
 * Uso (na pasta apps/api), com as mesmas variaveis da API (DATABASE_URL, GCS_*):
 *   pnpm ts-node prisma/move-private-files.ts                  # so mostra o que faria
 *   pnpm ts-node prisma/move-private-files.ts --aplicar        # copia e reescreve
 *   pnpm ts-node prisma/move-private-files.ts --aplicar --apagar-originais --bucket-so-deste-ambiente
 *
 * Dentro da imagem da API:
 *   docker exec crm-api node dist/prisma/move-private-files.js --aplicar
 *
 * Com GCS_BUCKET configurado os originais estao no bucket publico; o destino e o
 * GCS_PRIVATE_BUCKET (sem acesso publico) ou, sem ele, a pasta uploads-private/.
 *
 * So mexe nos arquivos das empresas que existem no banco em que roda (dev e prod podem
 * dividir o mesmo bucket publico). Apagar os originais exige bucket privado e a
 * confirmacao --bucket-so-deste-ambiente: com bucket dividido, empresa copiada de um
 * ambiente para o outro aponta para os mesmos arquivos e apagar quebraria o outro.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const APPLY = process.argv.includes('--aplicar');
const DELETE_ORIGINALS = process.argv.includes('--apagar-originais');
const BUCKET_ONLY_HERE = process.argv.includes('--bucket-so-deste-ambiente');
const PRIVATE_PREFIX = 'private:';

const prisma = new PrismaClient();
const bucketName = process.env.GCS_BUCKET || '';
const privateBucketName = process.env.GCS_PRIVATE_BUCKET || '';
const baseUrl = process.env.GCS_BASE_URL || `https://storage.googleapis.com/${bucketName || 'crm-builder-uploads'}`;
const storage = bucketName
  ? new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      ...(process.env.GCS_CREDENTIALS ? { credentials: JSON.parse(process.env.GCS_CREDENTIALS) } : {}),
      ...(process.env.GCS_KEY_FILE ? { keyFilename: process.env.GCS_KEY_FILE } : {}),
    })
  : null;
const PUBLIC_DIR = path.join(process.cwd(), 'uploads');
const PRIVATE_DIR = path.join(process.cwd(), 'uploads-private');

const stats = { movidos: 0, ignorados: 0, faltando: 0, apagados: 0, outraEmpresa: 0 };
const porTipo: Record<string, number> = { anexosChat: 0, relatoriosChat: 0, pdfsGerados: 0, arquivamento: 0, auditoria: 0 };

/** Empresas deste banco: so os arquivos delas (primeira pasta do caminho) sao mexidos. */
let tenantIds = new Set<string>();
const isOwnFile = (filePath: string) => tenantIds.has(filePath.split('/')[0]);

/** Caminho do arquivo dentro do armazenamento publico, a partir da URL gravada. */
function publicPathOf(url: string): string | null {
  if (url.startsWith('/uploads/')) return url.slice('/uploads/'.length);
  if (url.startsWith(`${baseUrl}/`)) return url.slice(baseUrl.length + 1);
  return null;
}

async function readPublic(filePath: string): Promise<Buffer | null> {
  if (storage) {
    const file = storage.bucket(bucketName).file(filePath);
    const [exists] = await file.exists();
    return exists ? (await file.download())[0] : null;
  }
  const local = path.join(PUBLIC_DIR, filePath);
  return fs.existsSync(local) ? fs.readFileSync(local) : null;
}

async function writePrivate(key: string, buffer: Buffer, contentType: string) {
  if (storage && privateBucketName) {
    await storage.bucket(privateBucketName).file(key).save(buffer, { metadata: { contentType } });
    return;
  }
  const local = path.join(PRIVATE_DIR, key);
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, buffer);
}

async function deletePublic(filePath: string) {
  if (!DELETE_ORIGINALS) return;
  if (storage) await storage.bucket(bucketName).file(filePath).delete({ ignoreNotFound: true });
  else fs.rmSync(path.join(PUBLIC_DIR, filePath), { force: true });
  stats.apagados++;
}

async function privateExists(key: string): Promise<boolean> {
  if (storage && privateBucketName) return (await storage.bucket(privateBucketName).file(key).exists())[0];
  return fs.existsSync(path.join(PRIVATE_DIR, key));
}

/** Copia um arquivo publico para o privado (mesma chave). null = nao achou o original. */
async function moveFile(filePath: string, contentType: string, tipo: string): Promise<string | null> {
  if (!isOwnFile(filePath)) {
    stats.outraEmpresa++;
    console.warn(`  de empresa que nao esta neste banco, ficou: ${filePath}`);
    return null;
  }
  const buffer = await readPublic(filePath);
  // Mais de um registro aponta para o mesmo arquivo: o primeiro ja levou
  if (!buffer && await privateExists(filePath)) return filePath;
  if (!buffer) {
    stats.faltando++;
    console.warn(`  faltando: ${filePath}`);
    return null;
  }
  if (!APPLY) console.log(`  mover: ${filePath}`);
  if (APPLY) {
    await writePrivate(filePath, buffer, contentType);
    await deletePublic(filePath);
  }
  stats.movidos++;
  porTipo[tipo]++;
  return filePath;
}

type AttachmentMeta = { url?: string; key?: string; mime?: string };

async function moveMessages() {
  const messages = await prisma.message.findMany({
    where: { type: { in: ['attachment', 'report'] } },
    select: { id: true, type: true, meta: true },
  });
  for (const m of messages) {
    const meta = (m.meta ?? {}) as Record<string, unknown>;
    let changed = false;
    if (m.type === 'attachment' && Array.isArray(meta.attachments)) {
      const list = meta.attachments as AttachmentMeta[];
      for (const a of list) {
        const filePath = a.url && !a.key ? publicPathOf(a.url) : null;
        if (!filePath) continue;
        const key = await moveFile(filePath, a.mime || 'application/octet-stream', 'anexosChat');
        if (key) { a.key = key; delete a.url; changed = true; }
      }
    } else if (m.type === 'report' && typeof meta.url === 'string' && !meta.fileKey) {
      const filePath = publicPathOf(meta.url);
      const key = filePath ? await moveFile(filePath, String(meta.contentType || 'application/octet-stream'), 'relatoriosChat') : null;
      if (key) { meta.fileKey = key; delete meta.url; changed = true; }
    }
    if (!changed) { stats.ignorados++; continue; }
    if (APPLY) await prisma.message.update({ where: { id: m.id }, data: { meta: meta as Prisma.InputJsonValue } });
  }
}

async function movePdfGenerations() {
  const generations = await prisma.pdfGeneration.findMany({
    where: { fileUrl: { not: null }, NOT: { fileUrl: { startsWith: PRIVATE_PREFIX } } },
    select: { id: true, fileUrl: true },
  });
  for (const g of generations) {
    const filePath = publicPathOf(g.fileUrl!);
    const key = filePath ? await moveFile(filePath, 'application/pdf', 'pdfsGerados') : null;
    if (!key) continue;
    if (APPLY) await prisma.pdfGeneration.update({ where: { id: g.id }, data: { fileUrl: `${PRIVATE_PREFIX}${key}` } });
  }
}

/** Arquivamento e auditoria: ninguem le por URL, so precisam sair do publico. */
async function moveFolders() {
  // So as pastas das empresas deste banco (o bucket pode ter as de outro ambiente)
  const isFolder = (p: string) => /^[^/]+\/(archives|audit-logs)\//.test(p);
  const isTarget = (p: string) => isFolder(p) && isOwnFile(p);
  const files: string[] = [];
  if (storage) {
    const [all] = await storage.bucket(bucketName).getFiles();
    files.push(...all.map((f) => f.name).filter(isTarget));
  } else if (fs.existsSync(PUBLIC_DIR)) {
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(path.relative(PUBLIC_DIR, full).split(path.sep).join('/'));
      }
    };
    walk(PUBLIC_DIR);
  }
  stats.outraEmpresa += files.filter((f) => isFolder(f) && !isOwnFile(f)).length;
  for (const f of files.filter(isTarget)) await moveFile(f, 'application/json', f.split('/')[1] === 'archives' ? 'arquivamento' : 'auditoria');
}

async function main() {
  if (DELETE_ORIGINALS && (!APPLY || !BUCKET_ONLY_HERE || (storage && !privateBucketName))) {
    console.error('Recusado: --apagar-originais exige --aplicar, GCS_PRIVATE_BUCKET (com GCS) e --bucket-so-deste-ambiente.');
    console.error('Com o bucket publico dividido entre ambientes, apagar quebraria os arquivos do outro.');
    process.exitCode = 1;
    return;
  }
  tenantIds = new Set((await prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id));
  console.log(APPLY ? 'Aplicando.' : 'Simulacao (nada e alterado). Use --aplicar para mover.');
  console.log(`Empresas deste banco: ${tenantIds.size} (so os arquivos delas sao mexidos).`);
  console.log(`Origem: ${storage ? `bucket ${bucketName}` : PUBLIC_DIR}. Destino: ${storage && privateBucketName ? `bucket ${privateBucketName}` : PRIVATE_DIR}.`);
  if (storage && !privateBucketName) {
    console.log('Aviso: sem GCS_PRIVATE_BUCKET os arquivos vao para o disco da API (volume uploads-private).');
  }
  await moveMessages();
  await movePdfGenerations();
  await moveFolders();
  console.log(JSON.stringify({ ...stats, porTipo }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
