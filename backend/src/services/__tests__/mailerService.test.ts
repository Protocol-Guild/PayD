import logger from '../../utils/logger.js';
import { MailerService } from '../notifications/mailerService.js';

const smtpKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_FROM'] as const;

describe('MailerService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.restoreAllMocks();
    for (const key of smtpKeys) delete process.env[key];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('logs a warning when SMTP is not configured', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await MailerService.sendMail({
      to: ['recipient@example.com'],
      subject: 'password-reset',
      text: 'Reset requested',
    });

    expect(warn).toHaveBeenCalledWith(
      'Email notification skipped: SMTP is not configured',
      expect.objectContaining({
        recipients: ['recipient@example.com'],
        mailType: 'password-reset',
      }),
    );
  });

  it('logs an error when nodemailer cannot be loaded', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'mailer@example.com';
    process.env.SMTP_PASS = 'secret';
    const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    await MailerService.sendMail({
      to: ['recipient@example.com'],
      subject: 'payroll-notification',
      text: 'Payroll ready',
    });

    expect(error).toHaveBeenCalledWith(
      'Email notification skipped: nodemailer could not be loaded',
      expect.objectContaining({
        recipients: ['recipient@example.com'],
        mailType: 'payroll-notification',
      }),
    );
  });
});
