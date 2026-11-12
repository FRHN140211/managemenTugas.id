import { launchAuthTest, closeAuthTest, setMockNeonAuth } from './auth-harness.js';

// Kontrol positif: DOM sintetis dengan gejala G1-G5
async function runPositiveControls() {
  const results = {};
  
  // Kontrol G1: forgot mode dengan duplikat email
  const testG1 = await launchAuthTest({ locale: 'id', viewport: { width: 375, height: 800 } });
  try {
    await testG1.page.click('[data-auth-mode-toggle]'); // to register
    await testG1.page.waitForTimeout(300);
    await testG1.page.click('[data-auth-mode-toggle]'); // back to login
    await testG1.page.waitForTimeout(300);
    await testG1.page.click('#auth-secondary-action'); // to forgot
    await testG1.page.waitForTimeout(300);
    
    const snapshot = await testG1.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => i.id);
      const fields = Array.from(document.querySelectorAll('[data-auth-field]')).map(f => f.getAttribute('data-auth-field'));
      return {
        inputCount: inputs.length,
        inputs,
        fields,
        hasAuthForgotEmail: inputs.includes('auth-forgot-email'),
        hasAuthEmail: inputs.includes('auth-email'),
        hasAuthName: inputs.includes('auth-name'),
        hasAuthPassword: inputs.includes('auth-password'),
        hasAuthPasswordConfirm: inputs.includes('auth-password-confirm')
      };
    });
    
    results.g1 = {
      detected: snapshot.inputCount > 4 && snapshot.hasAuthForgotEmail,
      snapshot
    };
  } finally {
    await closeAuthTest(testG1);
  }
  
  // Kontrol G2: register mode dengan tombol "Lupa Kata Sandi"
  const testG2 = await launchAuthTest({ locale: 'id', viewport: { width: 375, height: 800 } });
  try {
    await testG2.page.click('[data-auth-mode-toggle]'); // to register
    await testG2.page.waitForTimeout(300);
    
    const snapshot = await testG2.page.evaluate(() => {
      const secondary = document.getElementById('auth-secondary-action');
      const cs = secondary ? getComputedStyle(secondary) : null;
      return {
        secondaryHidden: secondary ? secondary.hidden : null,
        secondaryDisplay: cs ? cs.display : null,
        secondaryText: secondary ? secondary.textContent.trim() : null,
        allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
          id: b.id,
          text: b.textContent.trim(),
          hidden: b.hidden
        }))
      };
    });
    
    results.g2 = {
      detected: !snapshot.secondaryHidden && snapshot.secondaryDisplay !== 'none',
      snapshot
    };
  } finally {
    await closeAuthTest(testG2);
  }
  
  // Kontrol G4: mimic baseline (emailVerified:false -> generic alert + email-resend, no OTP)
  const testG4 = await launchAuthTest({ locale: 'id', viewport: { width: 375, height: 800 } });
  try {
    await testG4.page.click('[data-auth-mode-toggle]');
    await testG4.page.waitForTimeout(300);
    await testG4.page.fill('#auth-name', 'Test');
    await testG4.page.fill('#auth-email', `test-${Date.now()}@example.com`);
    await testG4.page.fill('#auth-password', 'TestPass123!');
    await testG4.page.fill('#auth-password-confirm', 'TestPass123!');
    
    // Mimic baseline mock: signup returns user with emailVerified:false
    setMockNeonAuth('POST:/api/neon-auth/sign-up/email', {
      token: null,
      user: {
        name: 'Test',
        email: `test-${Date.now()}@example.com`,
        emailVerified: false,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null,
        id: 'test-' + Date.now()
      }
    });
    
    await testG4.page.click('#auth-submit');
    await testG4.page.waitForTimeout(2000);
    
    const snapshot = await testG4.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        id: i.id,
        hidden: i.hidden
      }));
      const alertBox = document.getElementById('auth-alert');
      const alertTitle = alertBox ? alertBox.querySelector('[data-auth-alert-title]') : null;
      const hasEmailResend = !!document.getElementById('auth-email-resend');
      const hasOtpField = inputs.some(i => i.id === 'auth-otp' && !i.hidden);
      return {
        inputs,
        visibleInputCount: inputs.filter(i => !i.hidden).length,
        alertHidden: alertBox ? alertBox.hidden : null,
        alertTitle: alertTitle ? alertTitle.textContent.trim() : null,
        hasEmailResend,
        hasOtpField
      };
    });
    
    // G4: alert generik + tombol email-resend + tidak ada OTP field
    const g4 = !snapshot.alertHidden && snapshot.hasEmailResend && !snapshot.hasOtpField;
    results.g4 = { detected: g4, snapshot };
  } finally {
    await closeAuthTest(testG4);
  }
  
  // Kontrol G5: kartu email check dengan teks "tautan verifikasi"
  const testG5 = await launchAuthTest({ locale: 'id', viewport: { width: 375, height: 800 } });
  try {
    await testG5.page.click('[data-auth-mode-toggle]'); // to register
    await testG5.page.waitForTimeout(300);
    await testG5.page.fill('#auth-name', 'Test');
    await testG5.page.fill('#auth-email', `test-${Date.now()}@example.com`);
    await testG5.page.fill('#auth-password', 'TestPass123!');
    await testG5.page.fill('#auth-password-confirm', 'TestPass123!');
    
    // Mock signup returning verifikasi-email
    setMockNeonAuth('POST:/api/neon-auth/sign-up/email', {
      ok: false,
      alasan: 'verifikasi-email',
      email: 'test@example.com'
    });
    
    await testG5.page.click('#auth-submit');
    await testG5.page.waitForTimeout(1000);
    
    const snapshot = await testG5.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        id: i.id,
        hidden: i.hidden
      }));
      const bodyText = document.body.innerHTML;
      return {
        inputs,
        hasOtpField: inputs.some(i => i.id === 'auth-otp' && !i.hidden),
        hasEmailResend: !!document.getElementById('auth-email-resend'),
        hasLinkText: bodyText.includes('tautan verifikasi') || bodyText.includes('link verifikasi') || bodyText.includes('Kirim ulang tautan')
      };
    });
    
    // G5: shows "Kirim ulang tautan" (verifikasi link) without OTP
    const g5 = snapshot.hasEmailResend && snapshot.hasLinkText && !snapshot.hasOtpField;
    results.g5 = { detected: g5, snapshot };
  } finally {
    await closeAuthTest(testG5);
  }
  
  console.log('=== KONTROL POSITIF ===');
  console.log('G1 (forgot mode duplicate email):', results.g1.detected ? 'DETECTED' : 'NOT DETECTED', JSON.stringify(results.g1.snapshot, null, 2));
  console.log('G2 (register mode lupa button):', results.g2.detected ? 'DETECTED' : 'NOT DETECTED', JSON.stringify(results.g2.snapshot, null, 2));
  console.log('G4 (generic alert after register):', results.g4.detected ? 'DETECTED' : 'NOT DETECTED', JSON.stringify(results.g4.snapshot, null, 2));
  console.log('G5 (email check with link text):', results.g5.detected ? 'DETECTED' : 'NOT DETECTED', JSON.stringify(results.g5.snapshot, null, 2));
  
  return results;
}

runPositiveControls().catch(err => {
  console.error('Control test failed:', err);
  process.exit(1);
});
