import { Injectable } from '@nestjs/common';
import { Status } from '@prisma/client';
import { createHash } from 'crypto';
import sharp = require('sharp');
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

/** Dados publicos do aplicativo instalavel (PWA) de uma empresa. */
export interface TenantAppInfo {
  slug: string;
  name: string;
  shortName: string;
  brandColor: string | null;
  hasLogo: boolean;
  /** Muda quando nome, logo ou cor mudam: o navegador busca os icones de novo. */
  version: string;
}

type AppSettings = { app?: { enabled?: boolean; shortName?: string }; theme?: { brandColor?: string } };

@Injectable()
export class TenantAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
  ) {}

  /** Empresa ativa que ligou "Permitir instalar como aplicativo"; senao null. */
  private async enabledTenant(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, status: Status.ACTIVE },
      select: { slug: true, name: true, logo: true, settings: true },
    });
    const settings = (tenant?.settings ?? {}) as AppSettings;
    if (!tenant || settings.app?.enabled !== true) return null;
    return { ...tenant, settings };
  }

  async info(slug: string): Promise<TenantAppInfo | null> {
    const tenant = await this.enabledTenant(slug);
    if (!tenant) return null;
    const brandColor = tenant.settings.theme?.brandColor ?? null;
    const shortName = tenant.settings.app?.shortName || tenant.name.slice(0, 20);
    const version = createHash('sha1')
      .update([tenant.name, shortName, tenant.logo ?? '', brandColor ?? ''].join('|'))
      .digest('hex')
      .slice(0, 10);
    return { slug: tenant.slug, name: tenant.name, shortName, brandColor, hasLogo: !!tenant.logo, version };
  }

  /** Logo da empresa em PNG (ate 512 px), para montar os icones. null = sem logo legivel. */
  async logoPng(slug: string): Promise<Buffer | null> {
    const tenant = await this.enabledTenant(slug);
    if (!tenant?.logo) return null;
    const original = await this.upload.readOwnPublic(tenant.logo);
    if (!original) return null;
    try {
      return await sharp(original, { limitInputPixels: 40_000_000 })
        .resize(512, 512, { fit: 'inside' })
        .png()
        .toBuffer();
    } catch {
      return null;
    }
  }
}
