import http from 'http';

process.env.VERCEL = '1';
process.env.CASHFREE_CLIENT_ID = 'TEST10609385025f1ca8f79f4c3a77bd58390601';
process.env.CASHFREE_CLIENT_SECRET = 'cfsk_ma_test_90e3ab7b8b2e1bf3c88fd36f2bca5c16_021966a3';
process.env.CASHFREE_ENV = 'sandbox';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details?: string;
}

async function runStage3FrontendTests() {
  console.log('================================================================');
  console.log('   QUIZPRO STAGE 3: FRONTEND & BACKEND END-TO-END SUITE       ');
  console.log('================================================================\n');

  const { default: app } = await import('../server.js');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test Express server running at: ${baseUrl}\n`);
  const results: TestResult[] = [];
  const testToken = 'Bearer test_token_stage3_student_101';

  try {
    // -------------------------------------------------------------
    // TEST 1: All 4 Subscription Plans Order Creation & Price Verification
    // -------------------------------------------------------------
    const plansToTest = [
      { id: 'monthly', expectedPrice: 21 },
      { id: 'quarterly', expectedPrice: 100 },
      { id: 'half_yearly', expectedPrice: 149 },
      { id: 'yearly', expectedPrice: 199 }
    ];

    for (let i = 0; i < plansToTest.length; i++) {
      const plan = plansToTest[i];
      const res = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': testToken
        },
        body: JSON.stringify({ planId: plan.id, userPhone: '9876543210' })
      });
      const data = await res.json();
      const passed = res.status === 200 && data.success === true && data.order_amount === plan.expectedPrice;
      results.push({
        id: i + 1,
        name: `Screen 1 Plan Selection: ${plan.id.toUpperCase()} (₹${plan.expectedPrice})`,
        passed,
        details: passed ? `OrderId: ${data.order_id}, Amount: ₹${data.order_amount}` : `Failed: ${JSON.stringify(data)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 5: Complete End-to-End Payment Flow & Server Verification
    // -------------------------------------------------------------
    {
      const createRes = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': testToken
        },
        body: JSON.stringify({ planId: 'yearly', userPhone: '9876543210' })
      });
      const createData = await createRes.json();
      const orderId = createData.order_id;

      const verifyRes = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, isSimulatedTest: true })
      });
      const verifyData = await verifyRes.json();

      const passed = verifyRes.status === 200 && verifyData.isPaid === true && Boolean(verifyData.subscription);
      results.push({
        id: 5,
        name: 'Screen 3/4 E2E Checkout -> Server Verification -> Subscription Activation',
        passed,
        details: passed ? `Verified PAID. Expiry: ${verifyData.subscription?.expiryDate}` : `Failed: ${JSON.stringify(verifyData)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 6: Duplicate Payment Verification Protection
    // -------------------------------------------------------------
    {
      const createRes = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': testToken
        },
        body: JSON.stringify({ planId: 'yearly' })
      });
      const createData = await createRes.json();
      const orderId = createData.order_id;

      // Verify once
      await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, isSimulatedTest: true })
      });

      // Verify second time
      const verifyRes2 = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, isSimulatedTest: true })
      });
      const verifyData2 = await verifyRes2.json();

      const passed = verifyRes2.status === 200 && verifyData2.alreadyActivated === true;
      results.push({
        id: 6,
        name: 'Duplicate verification prevention (alreadyActivated flag)',
        passed,
        details: passed ? `Duplicate check passed: alreadyActivated = true` : `Failed: ${JSON.stringify(verifyData2)}`
      });
    }

  } finally {
    server.close();
  }

  console.log('----------------------------------------------------------------');
  console.log('                 STAGE 3 FRONTEND TEST RESULTS                  ');
  console.log('----------------------------------------------------------------');
  let passedCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${symbol} Test #${r.id}: ${r.name}`);
    if (r.details) console.log(`          ↳ ${r.details}`);
    if (r.passed) passedCount++;
  }
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${passedCount} / ${results.length} PASSED`);
  console.log('----------------------------------------------------------------\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runStage3FrontendTests().catch((err) => {
  console.error('Stage 3 test runner error:', err);
  process.exit(1);
});
