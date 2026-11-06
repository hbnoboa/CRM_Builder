/**
 * Ponte SO DE DEV entre a API e o Claude Code instalado na VM: a API manda o
 * pedido do assistente, a ponte roda `claude -p` com o login de quem administra a
 * VM e devolve a resposta estruturada. Em producao o assistente usa a API da
 * Anthropic; esta ponte nunca roda la.
 *
 * Seguranca: sem ferramentas (--tools ""), sem MCP, sem sessao salva, numa pasta
 * temporaria vazia; token obrigatorio; escuta so no IP que a rede do Docker alcanca.
 *
 * Uso (Node 22.6+ roda TypeScript direto):
 *   AI_BRIDGE_TOKEN=<openssl rand -hex 32> AI_BRIDGE_HOST=172.17.0.1 \
 *     node scripts/ai-bridge/claude-bridge.mts
 * Opcionais: AI_BRIDGE_PORT (8787), CLAUDE_BIN (claude), AI_BRIDGE_MODEL, AI_BRIDGE_EFFORT.
 */
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = process.env.AI_BRIDGE_TOKEN ?? '';
const HOST = process.env.AI_BRIDGE_HOST ?? '127.0.0.1';
const PORT = Number(process.env.AI_BRIDGE_PORT ?? 8787);
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
const MODEL = process.env.AI_BRIDGE_MODEL;
const EFFORT = process.env.AI_BRIDGE_EFFORT ?? 'low';
const MAX_BODY = 512 * 1024;
const TIMEOUT_MS = 180_000;
const MAX_RUNNING = 2;

if (TOKEN.length < 24) {
  console.error('Defina AI_BRIDGE_TOKEN (24+ caracteres), ex.: openssl rand -hex 32');
  process.exit(1);
}

interface ProposeBody {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}

interface ClaudeResult {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  duration_ms?: number;
}

let running = 0;

function authorized(req: IncomingMessage): boolean {
  const got = Buffer.from(String(req.headers.authorization ?? ''));
  const want = Buffer.from(`Bearer ${TOKEN}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('corpo grande demais');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function runClaude({ system, prompt, schema }: ProposeBody): Promise<ClaudeResult> {
  const cwd = await mkdtemp(join(tmpdir(), 'ai-bridge-'));
  const args = [
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--setting-sources', 'project',
    '--effort', EFFORT,
    '--system-prompt', system,
    '--json-schema', JSON.stringify(schema),
    ...(MODEL ? ['--model', MODEL] : []),
  ];
  try {
    return await new Promise<ClaudeResult>((resolve, reject) => {
      const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(out) as ClaudeResult);
        } catch {
          reject(new Error(`claude saiu com ${code}: ${err.slice(0, 300) || out.slice(0, 300)}`));
        }
      });
      child.stdin.end(prompt);
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/propose') return send(res, 404, { error: 'not found' });
    if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
    if (running >= MAX_RUNNING) return send(res, 429, { error: 'ocupado' });

    let body: ProposeBody;
    try {
      body = JSON.parse(await readBody(req)) as ProposeBody;
      if (typeof body.system !== 'string' || typeof body.prompt !== 'string' || typeof body.schema !== 'object') {
        throw new Error('formato invalido');
      }
    } catch (e) {
      return send(res, 400, { error: (e as Error).message });
    }

    running += 1;
    const started = Date.now();
    try {
      const result = await runClaude(body);
      if (result.is_error || result.structured_output === undefined) {
        console.error(`[ai-bridge] erro do claude: ${String(result.result ?? '').slice(0, 300)}`);
        return send(res, 502, { error: 'sem resposta estruturada' });
      }
      console.log(`[ai-bridge] ok ${Date.now() - started}ms custo=$${(result.total_cost_usd ?? 0).toFixed(4)}`);
      return send(res, 200, { output: result.structured_output, costUsd: result.total_cost_usd, durationMs: Date.now() - started });
    } catch (e) {
      console.error(`[ai-bridge] falhou: ${(e as Error).message}`);
      return send(res, 502, { error: 'falha ao rodar o claude' });
    } finally {
      running -= 1;
    }
  })();
});

server.listen(PORT, HOST, () => console.log(`[ai-bridge] ouvindo em http://${HOST}:${PORT}`));
