import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const out = {
    pageErrors: [],
    loginTitle: '',
    registerTitle: '',
    otpModeShown: false,
    otpHeading: '',
    otpDescription: '',
    resendButtonVisible: false,
    resendButtonText: '',
    emailReadOnly: false,
    invalidOtpResult: null
  };

  page.on('pageerror', err => out.pageErrors.push(err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  out.loginTitle = await page.title();

  // Switch to register mode
  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(300);
  out.registerTitle = await page.title();

  // Fill registration form with a test email
  const testEmail = 'otp-test-' + Date.now() + '@example.com';
  await page.fill('#auth-name', 'OTP Test User');
  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');

  // Submit registration
  await page.click('#auth-submit');
  await page.waitForTimeout(2000);

  // Check if OTP mode is shown
  out.otpModeShown = await page.isVisible('[data-auth-field="verifikasi-otp"]');
  out.otpHeading = await page.textContent('[data-auth-heading]');
  out.otpDescription = await page.textContent('[data-auth-description]');
  out.resendButtonVisible = await page.isVisible('#auth-resend-otp');
  out.resendButtonText = await page.textContent('#auth-resend-otp');
  out.emailReadOnly = await page.isDisabled('#auth-email');

  // Test invalid OTP
  if (out.otpModeShown) {
    await page.fill('#auth-otp', '000000');
    await page.click('#auth-submit');
    await page.waitForTimeout(2000);
    out.invalidOtpResult = await page.evaluate(() => {
      const alert = document.querySelector('[data-auth-alert-title]');
      return alert ? alert.textContent : '';
    });
  }

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
