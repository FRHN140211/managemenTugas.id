import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const out = {
    pageErrors: [],
    loginTitle: '',
    registerTitle: '',
    networkErrors: [],
    registrationResponse: null,
    alertTitle: '',
    alertMessage: '',
    otpModeShown: false,
    otpHeading: '',
    otpDescription: '',
    resendButtonVisible: false,
    emailReadOnly: false
  };

  page.on('pageerror', err => out.pageErrors.push(err.message));

  // Intercept network requests
  page.on('response', async (response) => {
    if (response.url().includes('/api/neon-auth/')) {
      out.registrationResponse = {
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      };
      try {
        const body = await response.json();
        out.registrationResponse.body = body;
      } catch (e) {
        out.registrationResponse.body = await response.text();
      }
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  out.loginTitle = await page.title();

  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(500);
  out.registerTitle = await page.title();

  const testEmail = 'otp-test-' + Date.now() + '@example.com';
  await page.fill('#auth-name', 'OTP Test User');
  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');

  await page.click('#auth-submit');
  await page.waitForTimeout(4000);

  out.alertTitle = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-alert-title]');
    return el ? el.textContent : '';
  });
  out.alertMessage = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-alert-message]');
    return el ? el.textContent : '';
  });

  out.otpModeShown = await page.isVisible('[data-auth-field="verifikasi-otp"]');
  out.otpHeading = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-heading]');
    return el ? el.textContent : '';
  });
  out.otpDescription = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-description]');
    return el ? el.textContent : '';
  });
  out.resendButtonVisible = await page.isVisible('#auth-resend-otp');
  out.emailReadOnly = await page.isDisabled('#auth-email');

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
