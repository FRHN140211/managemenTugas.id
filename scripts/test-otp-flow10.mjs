import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text());
  });
  page.on('unhandledrejection', err => errors.push('UNHANDLED_REJECTION: ' + (err.message || err)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Manually trigger the registration flow and check what happens
  const result = await page.evaluate(async () => {
    const out = { steps: [], error: null };
    try {
      out.steps.push('1. Calling MT.store.registrasi');
      const hasil = await MT.store.registrasi('Test OTP', 'test-' + Date.now() + '@example.com', 'TestPass123!');
      out.steps.push('2. Store returned: ' + JSON.stringify(hasil));
      
      out.steps.push('3. Checking hasil.alasan');
      if (hasil && hasil.alasan === 'verifikasi-email') {
        out.steps.push('4. Calling renderMode("otp")');
        MT.viewsAuth.renderMode('otp');
        out.steps.push('5. renderMode("otp") completed');
        
        const otpField = document.querySelector('[data-auth-field="verifikasi-otp"]');
        out.steps.push('6. OTP field found: ' + !!otpField);
        if (otpField) {
          out.steps.push('7. OTP field hidden: ' + otpField.hidden);
        }
      } else {
        out.steps.push('4. Unexpected hasil: ' + JSON.stringify(hasil));
      }
    } catch (err) {
      out.error = err.message;
      out.stack = err.stack;
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  console.log('BROWSER ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
