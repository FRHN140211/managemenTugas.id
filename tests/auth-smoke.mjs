import { launchAuthTest, closeAuthTest } from './auth-harness.js';
import { writeFileSync } from 'fs';

(async () => {
  const test = await launchAuthTest({ locale: 'id', viewport: { width: 1280, height: 800 } });
  
  try {
    // Smoke checks
    const title = await test.page.title();
    const authForm = await test.page.$('#auth-form');
    const externalCount = test.getExternalCount();
    const blockedExternalCount = test.getBlockedExternalCount();
    const consoleErrors = test.consoleErrors.filter(err => 
      !err.includes('Service-Worker-Allowed') && 
      !err.includes('net::ERR_FAILED')
    );
    const pageErrCount = test.pageErrors.length;

    console.log('=== SMOKE TEST ===');
    console.log('Title:', title);
    console.log('Auth form exists:', !!authForm);
    console.log('External requests (blocked):', blockedExternalCount);
    console.log('External requests (non-font):', externalCount);
    console.log('Console errors (filtered):', consoleErrors.length, consoleErrors);
    console.log('Page errors:', pageErrCount);
    console.log('Locale loaded:', test.localeLoaded);

    // Save evidence
    const evidence = {
      title,
      authFormExists: !!authForm,
      externalRequests: test.externalRequests,
      externalBlockedCount: blockedExternalCount,
      externalNonFontCount: externalCount,
      consoleErrors: test.consoleErrors,
      consoleErrorsFiltered: consoleErrors,
      pageErrors: test.pageErrors,
      localeLoaded: test.localeLoaded
    };
    writeFileSync('tmp-state/evidence/smoke-test.json', JSON.stringify(evidence, null, 2));

    const passed = authForm && externalCount === 0 && consoleErrors.length === 0 && pageErrCount === 0;
    console.log('\nRESULT:', passed ? 'PASS' : 'FAIL');
    process.exit(passed ? 0 : 1);
  } finally {
    await closeAuthTest(test);
  }
})();
