import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

interface WelcomeEmailData {
  firstName: string;
  email: string;
}

interface PasswordResetEmailData {
  firstName: string;
  email: string;
  resetToken: string;
  resetUrl: string;
}

interface PasswordChangedEmailData {
  firstName: string;
  email: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Welcome to ShopSphere!',
        template: 'welcome',
        context: {
          firstName: data.firstName,
          loginUrl: `${this.frontendUrl}/login`,
          shopUrl: this.frontendUrl,
        },
      });
      this.logger.log(`Welcome email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${data.email}`, error);
    }
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    try {
      const resetUrl = `${this.frontendUrl}/reset-password?token=${data.resetToken}`;

      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Reset Your Password - ShopSphere',
        template: 'password-reset',
        context: {
          firstName: data.firstName,
          resetUrl,
          expiryTime: '1 hour',
        },
      });
      this.logger.log(`Password reset email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${data.email}`, error);
    }
  }

  async sendPasswordChangedEmail(data: PasswordChangedEmailData): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Your Password Has Been Changed - ShopSphere',
        template: 'password-changed',
        context: {
          firstName: data.firstName,
          supportEmail: 'support@shopsphere.com',
        },
      });
      this.logger.log(`Password changed email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${data.email}`, error);
    }
  }
}
