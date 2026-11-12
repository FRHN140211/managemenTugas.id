// lib/email.js — Email service with Resend provider
// Supports: Resend (default), SMTP (fallback), Mock (testing)
// No email is sent in test or development when EMAIL_PROVIDER=mock

import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Email service interface
// ---------------------------------------------------------------------------

export class EmailService {
  /**
   * Send an email
   * @param {Object} opts - Email options
   * @param {string} opts.to - Recipient email
   * @param {string} opts.subject - Subject line
   * @param {string} opts.html - HTML body
   * @param {string} [opts.text] - Plain text body (fallback)
   * @param {string} [opts.from] - From address
   * @param {string} [opts.replyTo] - Reply-to address
   * @returns {Promise<Object>} Send result
   */
  async send(opts) {
    throw new Error('EmailService.send() must be implemented by subclass');
  }

  /**
   * Validate configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig() {
    throw new Error('EmailService.validateConfig() must be implemented by subclass');
  }
}

// ---------------------------------------------------------------------------
// Resend provider adapter
// ---------------------------------------------------------------------------

export class ResendProvider extends EmailService {
  constructor() {
    super();
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || 'noreply@yourdomain.com';

    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY is not configured. Set it in .env.local to enable email delivery.'
      );
    }

    this.resend = new Resend(apiKey);
    this.from = from;
    this.provider = 'resend';
  }

  async send(opts) {
    const { to, subject, html, text, replyTo } = opts;

    if (!to) {
      throw new Error('Email recipient (to) is required.');
    }

    try {
      const data = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
        replyTo: replyTo || process.env.EMAIL_REPLY_TO
      });

      // Log safely (no secrets)
      console.log(`[EMAIL] Sent to ${to} via ${this.provider}`);
      return {
        success: true,
        messageId: data.id,
        provider: this.provider
      };
    } catch (error) {
      console.error('[EMAIL] Failed to send email:', error.message);
      throw new Error('Failed to send email. Please try again later.');
    }
  }

  validateConfig() {
    const errors = [];
    if (!process.env.RESEND_API_KEY) {
      errors.push('RESEND_API_KEY is not set');
    }
    if (!process.env.EMAIL_FROM) {
      errors.push('EMAIL_FROM is not set');
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Strip HTML tags for plain text fallback
  stripHtml(html) {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ---------------------------------------------------------------------------
// SMTP provider adapter
// ---------------------------------------------------------------------------

export class SmtpProvider extends EmailService {
  constructor() {
    super();
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error(
        'SMTP_HOST, SMTP_USER, and SMTP_PASS are required for SMTP provider.'
      );
    }

    this.host = host;
    this.port = port;
    this.user = user;
    this.pass = pass;
    this.from = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
    this.provider = 'smtp';
  }

  async send(opts) {
    const { to, subject, html, text, replyTo } = opts;

    if (!to) {
      throw new Error('Email recipient (to) is required.');
    }

    try {
      // Use SMTP transport (in production, use a proper SMTP library)
      // For now, we use a simple fetch-based approach as fallback
      const mailto = encodeURIComponent(JSON.stringify({
        to,
        subject,
        html,
        text,
        from: this.from,
        replyTo: replyTo || process.env.EMAIL_REPLY_TO
      }));

      // This is a placeholder - in production, use nodemailer or similar
      console.log(`[EMAIL] SMTP pending: ${to}`);
      throw new Error(
        'SMTP provider is not yet implemented in this simplified version. ' +
        'Set EMAIL_PROVIDER=resend with RESEND_API_KEY for production use.'
      );
    } catch (error) {
      console.error('[EMAIL] Failed to send email:', error.message);
      throw new Error('Failed to send email. Please try again later.');
    }
  }

  validateConfig() {
    const errors = [];
    if (!process.env.SMTP_HOST) {
      errors.push('SMTP_HOST is not set');
    }
    if (!process.env.SMTP_USER) {
      errors.push('SMTP_USER is not set');
    }
    if (!process.env.SMTP_PASS) {
      errors.push('SMTP_PASS is not set');
    }
    if (!process.env.EMAIL_FROM) {
      errors.push('EMAIL_FROM is not set');
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ---------------------------------------------------------------------------
// Mock provider (for testing, does NOT send emails)
// ---------------------------------------------------------------------------

export class MockProvider extends EmailService {
  constructor() {
    super();
    this.sent = [];
    this.provider = 'mock';
  }

  async send(opts) {
    const record = {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      from: opts.from,
      timestamp: new Date().toISOString()
    };
    this.sent.push(record);

    // Log safely (no secrets, only subject/sanitized)
    console.log(`[EMAIL:MOCK] to=${opts.to} subject=${opts.subject}`);

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      provider: this.provider,
      sent: record
    };
  }

  validateConfig() {
    return { valid: true, errors: [] };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate email provider based on environment.
 * - resend: production (with RESEND_API_KEY)
 * - smtp: fallback
 * - mock: development/testing
 */
export function createEmailService() {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  if (provider === 'resend') {
    return new ResendProvider();
  }

  if (provider === 'smtp') {
    return new SmtpProvider();
  }

  // Default: mock
  console.warn('[EMAIL] EMAIL_PROVIDER not set. Using mock provider (no emails sent).');
  return new MockProvider();
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Email verification template
 * @param {string} verifyUrl - Verification link
 * @returns {Object} { subject, html, text }
 */
export function emailVerificationTemplate(verifyUrl) {
  const subject = 'Verifikasi Email — ManagenTugas.id';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
        <div style="background: #2563eb; color: #fff; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 22px;">ManagenTugas.id</h1>
        </div>
        <div style="background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #4b5563;">Halo,</p>
          <p style="color: #4b5563;">Terima kasih telah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda:</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${verifyUrl}"
               style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Verifikasi Email
            </a>
          </p>
          <p style="color: #4b5563;">Atau salin link ini:</p>
          <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; color: #111827;">${verifyUrl}</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Link ini hanya berlaku 24 jam.</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.</p>
      </body>
    </html>
  `;
  const text = `Verifikasi Email — ManagenTugas.id

Halo,

Terima kasih telah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda:

${verifyUrl}

Link ini hanya berlaku 24 jam.

© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.
`;
  return { subject, html, text };
}

/**
 * Password reset request template
 * @param {string} resetUrl - Reset password link
 * @param {string} expireIn - Expiration message
 * @returns {Object} { subject, html, text }
 */
export function passwordResetRequestTemplate(resetUrl, expireIn = '1 jam') {
  const subject = 'Atur Ulang Kata Sandi — ManagenTugas.id';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
        <div style="background: #2563eb; color: #fff; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 22px;">ManagenTugas.id</h1>
        </div>
        <div style="background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #4b5563;">Halo,</p>
          <p style="color: #4b5563;">Kami menerima permohonan untuk Atur Ulang Kata Sandi. Klik tombol di bawah untuk melanjutkan:</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}"
               style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Atur Ulang Kata Sandi
            </a>
          </p>
          <p style="color: #4b5563;">Link ini hanya berlaku selama ${expireIn}.</p>
          <p style="color: #9ca3af; font-size: 12px;">Jika Anda tidak melakukan permohonan ini, abaikan email ini.</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.</p>
      </body>
    </html>
  `;
  const text = `Atur Ulang Kata Sandi — ManagenTugas.id

Halo,

Kami menerima permohonan untuk Atur Ulang Kata Sandi. Klik tombol di bawah untuk melanjutkan:

${resetUrl}

Link ini hanya berlaku selama 1 jam.

Jika Anda tidak melakukan permohonan ini, abaikan email ini.

© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.
`;
  return { subject, html, text };
}

/**
 * Password reset confirmation template
 * @returns {Object} { subject, html, text }
 */
export function passwordResetConfirmedTemplate() {
  const subject = 'Kata Sandi Telah Diubah — ManagenTugas.id';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
        <div style="background: #059669; color: #fff; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 22px;">ManagenTugas.id</h1>
        </div>
        <div style="background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #4b5563;">Halo,</p>
          <p style="color: #4b5563;">Kata sandi Anda telah berhasil diubah. Anda dapat sekarang login dengan kata sandi baru.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.APP_BASE_URL || 'https://management-tugas.example.com'}"
               style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Login Sekarang
            </a>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.</p>
      </body>
    </html>
  `;
  const text = `Kata Sandi Telah Diubah — ManagenTugas.id

Halo,

Kata sandi Anda telah berhasil diubah. Anda dapat sekarang login dengan kata sandi baru.

${process.env.APP_BASE_URL || 'https://management-tugas.example.com'}

© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.
`;
  return { subject, html, text };
}

/**
 * Email verification success template
 * @returns {Object} { subject, html, text }
 */
export function emailVerifiedTemplate() {
  const subject = 'Email Telah Terverifikasi — ManagenTugas.id';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
        <div style="background: #059669; color: #fff; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 22px;">ManagenTugas.id</h1>
        </div>
        <div style="background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #4b5563;">Halo,</p>
          <p style="color: #4b5563;">Email Anda telah berhasil diverifikasi. Konten lengkap dapat diakses di:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.APP_BASE_URL || 'https://management-tugas.example.com'}"
               style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Masuk ke Akun
            </a>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.</p>
      </body>
    </html>
  `;
  const text = `Email Telah Terverifikasi — ManagenTugas.id

Halo,

Email Anda telah berhasil diverifikasi. Konten lengkap dapat diakses di:

${process.env.APP_BASE_URL || 'https://management-tugas.example.com'}

© ${new Date().getFullYear()} ManagenTugas.id. Semua hak dilindungi.
`;
  return { subject, html, text };
}
