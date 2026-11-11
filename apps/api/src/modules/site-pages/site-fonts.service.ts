import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

export const MAX_FONT_BYTES = 2 * 1024 * 1024;
const MAX_FONTS = 12;

/** Tipo pelo conteudo do arquivo (nao confia na extensao nem no tipo informado). */
function fontKind(buf: Buffer): { mime: string } | null {
  const head = buf.subarray(0, 4).toString('latin1');
  if (head === 'wOF2') return { mime: 'font/woff2' };
  if (head === 'wOFF') return { mime: 'font/woff' };
  if (head === 'OTTO') return { mime: 'font/otf' };
  if (head === 'true' || buf.readUInt32BE(0) === 0x00010000) return { mime: 'font/ttf' };
  return null;
}

/**
 * Fontes enviadas pela empresa para o site. O arquivo fica no banco e a API
 * serve para as paginas (mesmo endereco do site: sem problema de outro dominio).
 */
@Injectable()
export class SiteFontsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    return this.prisma.siteFont.findMany({
      where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, size: true, createdAt: true },
    });
  }

  async upload(file: Express.Multer.File | undefined, rawName: string | undefined, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    if (!file?.buffer?.length) throw new BadRequestException('Escolha o arquivo da fonte.');
    if (file.size > MAX_FONT_BYTES) throw new BadRequestException('A fonte pode ter no máximo 2 MB.');
    const kind = fontKind(file.buffer);
    if (!kind) throw new BadRequestException('Arquivo de fonte inválido. Envie .woff2, .woff, .ttf ou .otf.');
    const count = await this.prisma.siteFont.count({ where: { tenantId } });
    if (count >= MAX_FONTS) throw new BadRequestException(`Cada empresa pode ter até ${MAX_FONTS} fontes. Apague uma para enviar outra.`);
    const fromFile = (file.originalname || '').replace(/\.[^.]+$/, '');
    const name = (rawName || fromFile || 'Minha fonte').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'Minha fonte';
    return this.prisma.siteFont.create({
      data: { tenantId, name, mime: kind.mime, size: file.size, data: file.buffer },
      select: { id: true, name: true, size: true, createdAt: true },
    });
  }

  async remove(id: string, user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const font = await this.prisma.siteFont.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!font) throw new NotFoundException('Fonte não encontrada');
    await this.prisma.siteFont.delete({ where: { id } });
    return { ok: true };
  }

  /** Arquivo da fonte para o site (publico: quem abre a pagina precisa da fonte). */
  async file(id: string) {
    const font = await this.prisma.siteFont.findUnique({ where: { id: id.slice(0, 40) }, select: { mime: true, data: true } });
    if (!font) throw new NotFoundException('Fonte não encontrada');
    return font;
  }

  /** Fontes da empresa para a pagina publica (o web monta o @font-face). */
  async forTenant(tenantId: string) {
    return this.prisma.siteFont.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  }
}
