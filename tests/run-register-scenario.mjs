import { launchAuthTest, closeAuthTest, setMockNeonAuth } from './auth-harness.js';
import { writeFileSync } from 'fs';

(async () => {
  const test = await launchAuthTest({ locale: 'id', viewport: { width: 375, height: 800 } });
  try {
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(300);
    await test.page.fill('#auth-name', 'Uji');
    await test.page.fill('#auth-email', 'uji@example.com');
    await test.page.fill('#auth-password', 'TestPass123!');
    await test.page.fill('#auth-password-confirm', 'TestPass123!');

    setMockNeonAuth('POST:/api/neon-auth/sign-up/email', {
      token: null,
      user: {
        id: 'x',
        name: 'Uji',
        email: 'uji@example.com',
        emailVerified: false,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null
      }
    });

    await test.page.click('#auth-submit');
    await test.page.waitForTimeout(2000);

    const snapshot = await test.page.evaluate(() => {
      const alerts = Array.from(document.querySelectorAll('[data-auth-alert-title], [data-auth-alert-message]')).map(el => ({
        id: el.id || null,
        text: el.textContent.trim(),
        hidden: el.hidden || false
      }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        id: b.id || null,
        text: b.textContent.trim(),
        hidden: b.hidden || false,
        className: b.className || null
      }));
      return {
        title: document.title,
        alerts,
        visibleButtons: buttons.filter(b => !b.hidden),
        pageErrors: window.__pageErrors || []
      };
    });

    console.log('=== SNAPSHOT ===');
    console.log('title:', snapshot.title);
    console.log('alerts:', JSON.stringify(snapshot.alerts, null, 2));
    console.log('visibleButtons:', JSON.stringify(snapshot.visibleButtons, null, 2));
    console.log('pageErrors:', JSON.stringify(snapshot.pageErrors, null, 2));

    writeFileSync('tmp-state/evidence/register-emailverified-false.json', JSON.stringify(snapshot, null, 2));
  } finally {
    await closeAuthTest(test);
  }
})();
