import { launchAuthTest, closeAuthTest, setMockNeonAuth } from './auth-harness.js';
import { writeFileSync, mkdirSync } from 'fs';

const EVIDENCE_DIR = 'tmp-state/evidence';
const SCREENSHOT_DIR = `${EVIDENCE_DIR}/screens`;

function ensureDirs() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function snapshotForm(page) {
  return page.evaluate(() => {
    const result = {
      title: document.title,
      inputs: [],
      buttons: [],
      links: [],
      alerts: [],
      fields: [],
      textContent: '',
      elementCounts: {}
    };

    // Count elements by type
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      result.elementCounts[tag] = (result.elementCounts[tag] || 0) + 1;
    });

    // Inputs
    document.querySelectorAll('input, textarea, select').forEach(el => {
      result.inputs.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        type: el.type || null,
        name: el.name || null,
        placeholder: el.placeholder || null,
        hidden: el.hidden || false,
        disabled: el.disabled || false,
        ariaLabel: el.getAttribute('aria-label') || null,
        value: el.value || null
      });
    });

    // Buttons
    document.querySelectorAll('button, [role="button"]').forEach(el => {
      result.buttons.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        text: el.textContent.trim(),
        hidden: el.hidden || false,
        disabled: el.disabled || false,
        className: el.className || null
      });
    });

    // Links
    document.querySelectorAll('a[href], [data-auth-mode-toggle]').forEach(el => {
      result.links.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        text: el.textContent.trim(),
        href: el.href || null,
        hidden: el.hidden || false,
        className: el.className || null
      });
    });

    // Alerts
    document.querySelectorAll('[data-auth-alert-title], [data-auth-alert-message]').forEach(el => {
      result.alerts.push({
        id: el.id || null,
        text: el.textContent.trim(),
        hidden: el.hidden || false
      });
    });

    // Fields (data-auth-field)
    document.querySelectorAll('[data-auth-field]').forEach(el => {
      result.fields.push({
        field: el.getAttribute('data-auth-field'),
        hidden: el.hidden || false
      });
    });

    // auth-secondary-action details
    const secondaryAction = document.getElementById('auth-secondary-action');
    if (secondaryAction) {
      const rect = secondaryAction.getBoundingClientRect();
      const cs = window.getComputedStyle(secondaryAction);
      result.authSecondaryAction = {
        inDom: true,
        hidden: secondaryAction.hidden || false,
        display: cs.display,
        visibility: cs.visibility,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      };
    } else {
      result.authSecondaryAction = {
        inDom: false,
        hidden: null,
        display: null,
        visibility: null,
        boundingBox: null
      };
    }

    // Form text content
    const form = document.getElementById('auth-form');
    if (form) {
      result.textContent = form.textContent.trim();
    }

    return result;
  });
}

async function runScenario(locale, viewport) {
  const test = await launchAuthTest({ locale, viewport });
  const results = {
    locale,
    viewport: `${viewport.width}x${viewport.height}`,
    states: {}
  };

  try {
    // State 1: Initial (login mode)
    await test.page.waitForTimeout(500);
    results.states.initial = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-initial.png` });

    // State 2: login -> register
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);
    results.states.loginToRegister = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-login-to-register.png` });

    // State 3: register -> login
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);
    results.states.registerToLogin = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-register-to-login.png` });

    // State 4: login -> forgot
    const secondaryBtn = await test.page.$('#auth-secondary-action');
    if (secondaryBtn) {
      await secondaryBtn.click();
      await test.page.waitForTimeout(500);
    }
    results.states.loginToForgot = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-login-to-forgot.png` });

    // State 5: forgot -> login
    const backBtn = await test.page.$('#auth-secondary-action');
    if (backBtn) {
      await backBtn.click();
      await test.page.waitForTimeout(500);
    }
    results.states.forgotToLogin = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-forgot-to-login.png` });

    // State 6: login -> register -> login (register exists but can't go direct to forgot)
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);
    results.states.registerExists = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-register-exists.png` });

    // Back to login
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);

    // State 7: login -> forgot -> login -> register (forgot -> register via login)
    const forgotBtn = await test.page.$('#auth-secondary-action');
    if (forgotBtn) {
      await forgotBtn.click();
      await test.page.waitForTimeout(500);
    }
    const backFromForgot = await test.page.$('#auth-secondary-action');
    if (backFromForgot) {
      await backFromForgot.click();
      await test.page.waitForTimeout(500);
    }
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);
    results.states.forgotToRegisterViaLogin = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-forgot-to-register-via-login.png` });

    // Back to login for OTP test
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);

    // State 8: OTP flow (register with mock signup)
    // Switch to register mode first (name field is hidden in login)
    await test.page.click('[data-auth-mode-toggle]');
    await test.page.waitForTimeout(500);
    
    const testEmail = `otp-test-${Date.now()}@example.com`;
    await test.page.fill('#auth-name', 'OTP Test');
    await test.page.fill('#auth-email', testEmail);
    await test.page.fill('#auth-password', 'TestPass123!');
    await test.page.fill('#auth-password-confirm', 'TestPass123!');
    
    // Set mock for signup to return emailVerified: false
    setMockNeonAuth('POST:/api/neon-auth/sign-up/email', {
      token: null,
      user: {
        name: 'OTP Test',
        email: testEmail,
        emailVerified: false,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null,
        id: 'test-otp-' + Date.now()
      }
    });

    // Submit
    await test.page.click('#auth-submit');
    await test.page.waitForTimeout(3000);
    
    results.states.otpAfterRegister = await snapshotForm(test.page);
    await test.page.screenshot({ path: `${SCREENSHOT_DIR}/f1-${locale}-${viewport.width}-otp-after-register.png` });

    return results;
  } finally {
    await closeAuthTest(test);
  }
}

(async () => {
  ensureDirs();
  const baseline = {
    timestamp: new Date().toISOString(),
    scenarios: []
  };

  const locales = ['id', 'en'];
  const viewports = [
    { width: 375, height: 800 },
    { width: 1280, height: 800 }
  ];

  for (const locale of locales) {
    for (const viewport of viewports) {
      console.log(`Running scenario: ${locale} ${viewport.width}x${viewport.height}`);
      const result = await runScenario(locale, viewport);
      baseline.scenarios.push(result);
    }
  }

  writeFileSync(`${EVIDENCE_DIR}/auth-baseline.json`, JSON.stringify(baseline, null, 2));
  console.log('\nBaseline saved to', `${EVIDENCE_DIR}/auth-baseline.json`);
  process.exit(0);
})();
