import { readFileSync } from 'fs';

const baseline = JSON.parse(readFileSync('tmp-state/evidence/auth-baseline.json', 'utf-8'));

const findings = {
  G1: [], // Mode forgot: two forms, duplicate email, "Lupa Kata Sandi" as outline button, wrong text
  G2: [], // Mode register: "Lupa Kata Sandi" button appears above main button
  G3: [], // Mode register in id locale: English text ("Create account", "Already have an account? Sign in", English tab title)
  G4: [], // After register: shows generic alert instead of OTP mode
  G5: []  // Shows "Periksa email Anda - tautan verifikasi" without email proof
};

for (const scenario of baseline.scenarios) {
  for (const [stateName, state] of Object.entries(scenario.states)) {
    // G1: Check forgot mode for duplicate email fields
    if (stateName === 'loginToForgot' || stateName === 'forgotToLogin') {
      const emailInputs = state.inputs.filter(i => i.id === 'auth-email' || i.id === 'auth-forgot-email');
      if (emailInputs.length > 1) {
        findings.G1.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'Duplicate email fields',
          count: emailInputs.length
        });
      }
      
      // Check for "Lupa Kata Sandi" button in forgot mode
      const lupaButtons = state.buttons.filter(b => 
        b.text && b.text.toLowerCase().includes('lupa') || 
        b.text && b.text.toLowerCase().includes('forgot')
      );
      if (lupaButtons.length > 0) {
        findings.G1.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'Forgot password button present in forgot mode',
          buttons: lupaButtons.map(b => b.text)
        });
      }
    }
    
    // G2: Check register mode for "Lupa Kata Sandi" button
    if (stateName === 'loginToRegister' || stateName === 'registerExists' || stateName === 'forgotToRegisterViaLogin') {
      const lupaButtons = state.buttons.filter(b => 
        b.text && (b.text.toLowerCase().includes('lupa') || 
                   b.text.toLowerCase().includes('forgot') ||
                   b.text === 'auth.link_forgot_password')
      );
      if (lupaButtons.length > 0) {
        findings.G2.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'Forgot password button appears in register mode',
          buttons: lupaButtons.map(b => ({ text: b.text, hidden: b.hidden }))
        });
      }
    }
    
    // G3: Check register mode for English text in id locale
    if (stateName === 'loginToRegister' || stateName === 'registerExists') {
      if (scenario.locale === 'id') {
        const englishTexts = [];
        
        // Check title
        if (state.title && state.title.includes('Create Account')) {
          englishTexts.push({ field: 'title', value: state.title });
        }
        
        // Check buttons for English text
        state.buttons.forEach(b => {
          if (b.text && /^(Create account|Sign in|Register|Login|Verify|Resend)/i.test(b.text)) {
            englishTexts.push({ field: 'button', id: b.id, text: b.text });
          }
        });
        
        // Check textContent for English phrases
        if (state.textContent && /Already have an account|Don't have an account/i.test(state.textContent)) {
          englishTexts.push({ field: 'textContent', snippet: state.textContent.match(/Already have an account|Don't have an account[^]*/)?.[0]?.slice(0, 100) });
        }
        
        if (englishTexts.length > 0) {
          findings.G3.push({
            scenario: `${scenario.locale} ${scenario.viewport}`,
            state: stateName,
            issue: 'English text found in id locale register mode',
            examples: englishTexts.slice(0, 5)
          });
        }
      }
    }
    
    // G4: Check if OTP mode appears after register with emailVerified:false
    if (stateName === 'otpAfterRegister') {
      const otpField = state.fields.find(f => f.field === 'verifikasi-otp');
      const otpInput = state.inputs.find(i => i.id === 'auth-otp');
      const resendBtn = state.buttons.find(b => b.id === 'auth-resend-otp');
      
      const otpVisible = otpField && !otpField.hidden;
      const hasOtpInput = !!otpInput;
      const hasResendBtn = !!resendBtn && !resendBtn.hidden;
      
      if (!otpVisible || !hasOtpInput || !hasResendBtn) {
        findings.G4.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'OTP mode not shown after register',
          otpFieldHidden: otpField ? otpField.hidden : 'not found',
          otpInputExists: hasOtpInput,
          resendBtnHidden: resendBtn ? resendBtn.hidden : 'not found',
          alertTitle: state.alerts.find(a => !a.hidden)?.text || 'none'
        });
      }
      
      // Check for generic auth error alert
      const genericAlert = state.alerts.find(a => 
        !a.hidden && a.text && (a.text.includes('auth.auth_error_title') || a.text.includes('Kesalahan autentikasi'))
      );
      if (genericAlert) {
        findings.G4.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'Generic auth error shown instead of OTP mode',
          alert: genericAlert.text
        });
      }
    }
    
    // G5: Check for "Periksa email Anda" / "tautan verifikasi" text
    if (stateName === 'otpAfterRegister') {
      const hasLinkText = state.textContent && state.textContent.includes('tautan verifikasi');
      const hasCheckEmail = state.textContent && state.textContent.includes('Periksa email Anda');
      
      if (hasLinkText || hasCheckEmail) {
        findings.G5.push({
          scenario: `${scenario.locale} ${scenario.viewport}`,
          state: stateName,
          issue: 'Shows "check email/link verification" text instead of OTP code',
          hasLinkText,
          hasCheckEmail
        });
      }
    }
  }
}

console.log('=== BASELINE FINDINGS ===\n');
for (const [g, items] of Object.entries(findings)) {
  console.log(`${g}: ${items.length} findings`);
  items.forEach(item => {
    console.log(`  - ${item.scenario} [${item.state}]: ${item.issue}`);
    if (item.alert) console.log(`    alert: ${item.alert}`);
    if (item.buttons) console.log(`    buttons: ${JSON.stringify(item.buttons)}`);
  });
}

// Save summary
import { writeFileSync } from 'fs';
writeFileSync('tmp-state/evidence/baseline-summary.json', JSON.stringify(findings, null, 2));
console.log('\nSummary saved to tmp-state/evidence/baseline-summary.json');
