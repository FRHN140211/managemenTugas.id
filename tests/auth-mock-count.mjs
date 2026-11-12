import { launchAuthTest, closeAuthTest } from './auth-harness.js';
import { writeFileSync } from 'fs';

(async () => {
  const test = await launchAuthTest({ locale: 'id', viewport: { width: 1280, height: 800 } });
  
  try {
    // Wait for page to load
    await test.page.waitForTimeout(2000);
    
    console.log('=== NEON AUTH MOCK COUNT ===');
    console.log('Mocked Neon Auth calls:', test.externalResponses.length);
    console.log('External requests (non-font):', test.getExternalCount());
    console.log('External requests (blocked):', test.getBlockedExternalCount());
    
    // Count by host
    const hostCounts = {};
    test.externalRequests.forEach(r => {
      try {
        const url = new URL(r.url);
        const host = url.hostname;
        hostCounts[host] = (hostCounts[host] || 0) + 1;
      } catch (e) {}
    });
    console.log('External requests by host:', JSON.stringify(hostCounts, null, 2));
    
    // Check if any went to Neon
    const neonRequests = test.externalRequests.filter(r => 
      r.url.includes('neon.tech') || r.url.includes('neon')
    );
    console.log('Neon requests:', neonRequests.length);
    
    // Save updated evidence
    const evidence = {
      title: await test.page.title(),
      authFormExists: !!(await test.page.$('#auth-form')),
      externalRequests: test.externalRequests,
      externalResponses: test.externalResponses,
      mockedNeonAuthCount: test.externalResponses.length,
      externalNonFontCount: test.getExternalCount(),
      externalBlockedCount: test.getBlockedExternalCount(),
      consoleErrors: test.consoleErrors,
      pageErrors: test.pageErrors,
      localeLoaded: test.localeLoaded
    };
    writeFileSync('tmp-state/evidence/smoke-test.json', JSON.stringify(evidence, null, 2));
  } finally {
    await closeAuthTest(test);
  }
})();
