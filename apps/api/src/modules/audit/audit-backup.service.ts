import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class AuditBackupService {
  private readonly logger = new Logger(AuditBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Runs at 02:00 on the 1st of every month.
   * Backs up previous month's audit logs to GCS and purges them from DB.
   */
  @Cron('0 2 1 * *')
  async handleMonthlyBackup() {
    this.logger.log('Starting monthly audit log backup...');

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const yearMonth = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    try {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: previousMonth,
            lt: currentMonthStart,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (logs.length === 0) {
        this.logger.log(`No audit logs found for ${yearMonth}. Skipping backup.`);
        return;
      }

      const jsonContent = JSON.stringify(logs, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf-8');
      const fileName = `${yearMonth}.json`;

      await this.uploadService.uploadBuffer(
        buffer,
        fileName,
        'application/json',
        'platform',
        'audit-logs',
      );

      this.logger.log(`Uploaded ${logs.length} audit logs to GCS: audit-logs/${fileName}`);

      const deleted = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            gte: previousMonth,
            lt: currentMonthStart,
          },
        },
      });

      this.logger.log(`Deleted ${deleted.count} audit log records from database.`);
    } catch (error) {
      this.logger.error(`Failed monthly audit backup for ${yearMonth}: ${error}`);
    }
  }
}
