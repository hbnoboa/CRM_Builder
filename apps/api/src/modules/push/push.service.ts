import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Push notification service using Firebase Cloud Messaging (FCM).
 * Manages device token registration and sends push notifications.
 *
 * Requires firebase-admin package and FIREBASE_SERVICE_ACCOUNT_KEY env var.
 * If Firebase is not configured, push sending is silently skipped.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private firebaseApp: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeFirebase();
  }

  private async initializeFirebase() {
    try {
      const serviceAccountKey = this.config.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_KEY',
      );
      if (!serviceAccountKey) {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_KEY not set - push notifications disabled',
        );
        return;
      }

      const admin = await import('firebase-admin');
      const serviceAccount = JSON.parse(serviceAccountKey);

      this.firebaseApp = admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized for push notifications');
    } catch (error) {
      this.logger.warn(
        `Firebase initialization skipped: ${error.message}`,
      );
    }
  }

  /**
   * Register a device token for push notifications.
   */
  async registerDevice(
    userId: string,
    token: string,
    platform: string,
  ) {
    // Upsert: update if token exists, create otherwise
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform,
      },
      update: {
        userId,
        platform,
      },
    });
  }

  /**
   * Remove a device token (e.g. on logout).
   */
  async unregisterDevice(token: string) {
    try {
      await this.prisma.deviceToken.delete({
        where: { token },
      });
    } catch {
      // Token may not exist, ignore
    }
  }

  /**
   * Remove all device tokens for a user (e.g. on account deletion).
   */
  async unregisterAllDevices(userId: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Send push notification to a specific user via their registered devices.
   */
  async sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    if (!this.firebaseApp) return;

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
    });

    if (devices.length === 0) return;

    const tokens = devices.map((d) => d.token);

    try {
      const admin = await import('firebase-admin');
      const messaging = admin.default.messaging();

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        tokens,
      };

      const response = await messaging.sendEachForMulticast(message);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          await this.prisma.deviceToken.deleteMany({
            where: { token: { in: invalidTokens } },
          });
          this.logger.log(
            `Cleaned up ${invalidTokens.length} invalid device tokens`,
          );
        }
      }

      this.logger.log(
        `Push sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Failed to send push to user ${userId}: ${error}`);
    }
  }
}
