import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Directly test the store.registrasi function
  const result = await page.evaluate(async () => {
    try {
      const res = await MT.store.registrasi('Direct Test', 'direct-' + Date.now() + '@example.com', 'TestPass123!');
      return { success: true, result: res };
    } catch (err) {
      return { success: false, error: err.message, code: err.code };
    }
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
