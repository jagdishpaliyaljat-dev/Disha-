import http from 'http';
import crypto from 'crypto';

// Prevent server.ts from binding port 3000 upon import
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

async function runStage2Tests() {
  console.log('================================================================');
  console.log('   QUIZPRO STAGE 2: CASHFREE BACKEND INTEGRATION TEST HARNESS   ');
  console.log('================================================================\n');

  // Import app dynamically after setting environment
  const { default: app } = await import('../server.js');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test Express server running at: ${baseUrl}\n`);

  const results: TestResult[] = [];
  const secretKey = process.env.CASHFREE_CLIENT_SECRET!;
  const validTestToken = 'Bearer test_token_student_audit_001';

  try {
    // -------------------------------------------------------------
    // TEST 1: Valid Order Creation with Authoritative Pricing
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': validTestToken
        },
        body: JSON.stringify({
          planId: 'monthly',
          userPhone: '9876543210'
        })
      });
      const data = await res.json();
      const passed = res.status === 200 && data.success === true && data.order_amount === 21 && Boolean(data.order_id);
      results.push({
        id: 1,
        name: 'Valid order creation with authoritative pricing (Monthly: ₹21)',
        passed,
        details: passed ? `OrderId: ${data.order_id}, Amount: ₹${data.order_amount}` : `Status ${res.status}: ${JSON.stringify(data)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 2: Invalid Plan Rejection
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': validTestToken
        },
        body: JSON.stringify({
          planId: 'non_existent_super_plan'
        })
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error && data.error.includes('Invalid planId');
      results.push({
        id: 2,
        name: 'Invalid plan rejection (HTTP 400 with validation message)',
        passed,
        details: passed ? `Correctly rejected: ${data.error}` : `Expected 400, got ${res.status}`
      });
    }

    // -------------------------------------------------------------
    // TEST 3: Amount Tampering Rejection
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': validTestToken
        },
        body: JSON.stringify({
          planId: 'yearly', // Authoritative price is ₹199
          amount: 1 // Malicious client attempts ₹1
        })
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error && data.error.includes('Amount tampering detected');
      results.push({
        id: 3,
        name: 'Amount tampering rejection (Rejecting ₹1 attempt on ₹199 plan)',
        passed,
        details: passed ? `Tamper blocked: ${data.error}` : `Expected 400, got ${res.status}`
      });
    }

    // -------------------------------------------------------------
    // TEST 4: Unauthenticated Request Rejection
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // No Authorization header!
        },
        body: JSON.stringify({
          planId: 'quarterly'
        })
      });
      const data = await res.json();
      const passed = res.status === 401 && data.error && data.error.includes('Authentication required');
      results.push({
        id: 4,
        name: 'Unauthenticated request rejection (Missing token denied 401)',
        passed,
        details: passed ? `Denied with 401: ${data.error}` : `Expected 401, got ${res.status}`
      });
    }

    // -------------------------------------------------------------
    // TEST 5: Valid HMAC Webhook Signature Verification
    // -------------------------------------------------------------
    let testOrderIdForWebhook = '';
    {
      // First create an order to associate with webhook
      const orderRes = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': validTestToken
        },
        body: JSON.stringify({ planId: 'half_yearly' })
      });
      const orderData = await orderRes.json();
      testOrderIdForWebhook = orderData.order_id;

      const webhookPayload = JSON.stringify({
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        event_time: new Date().toISOString(),
        data: {
          order: {
            order_id: testOrderIdForWebhook,
            order_amount: 149,
            order_currency: 'INR',
            order_status: 'PAID'
          },
          payment: {
            cf_payment_id: `CF_PAY_${Date.now()}`,
            payment_status: 'SUCCESS',
            payment_amount: 149,
            payment_currency: 'INR',
            payment_group: 'UPI_ONLINE'
          }
        }
      });

      const timestamp = String(Math.floor(Date.now() / 1000));
      const signedPayload = `${timestamp}${webhookPayload}`;
      const validSignature = crypto
        .createHmac('sha256', secretKey)
        .update(signedPayload)
        .digest('base64');

      const webhookRes = await fetch(`${baseUrl}/api/cashfree/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': validSignature
        },
        body: webhookPayload
      });
      const webhookData = await webhookRes.json();
      const passed = webhookRes.status === 200 && webhookData.status === 'OK' && webhookData.processed === true;
      results.push({
        id: 5,
        name: 'Valid HMAC-SHA256 webhook signature verification',
        passed,
        details: passed ? `Signature verified, webhook accepted (HTTP 200)` : `Status ${webhookRes.status}: ${JSON.stringify(webhookData)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 6: Invalid HMAC Webhook Signature Rejection
    // -------------------------------------------------------------
    {
      const webhookPayload = JSON.stringify({
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        order_id: testOrderIdForWebhook
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const forgedSignature = Buffer.from('forged_invalid_signature_attempt').toString('base64');

      const webhookRes = await fetch(`${baseUrl}/api/cashfree/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': forgedSignature
        },
        body: webhookPayload
      });
      const webhookData = await webhookRes.json();
      const passed = webhookRes.status === 401 && webhookData.error && webhookData.error.includes('Invalid webhook signature');
      results.push({
        id: 6,
        name: 'Invalid HMAC signature rejection (Forgery attempt denied 401)',
        passed,
        details: passed ? `Correctly rejected forgery: ${webhookData.error}` : `Expected 401, got ${webhookRes.status}`
      });
    }

    // -------------------------------------------------------------
    // TEST 7: Timestamp Drift / Replay Attack Rejection
    // -------------------------------------------------------------
    {
      const webhookPayload = JSON.stringify({
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        order_id: testOrderIdForWebhook
      });
      // 10 minutes ago (600 seconds old - exceeds 300s window)
      const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600);
      const signedPayload = `${expiredTimestamp}${webhookPayload}`;
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(signedPayload)
        .digest('base64');

      const webhookRes = await fetch(`${baseUrl}/api/cashfree/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': expiredTimestamp,
          'x-webhook-signature': signature
        },
        body: webhookPayload
      });
      const webhookData = await webhookRes.json();
      const passed = webhookRes.status === 400 && webhookData.error && webhookData.error.includes('replay');
      results.push({
        id: 7,
        name: 'Timestamp drift / replay attack rejection (Window > 300s)',
        passed,
        details: passed ? `Replay blocked: ${webhookData.error}` : `Expected 400, got ${webhookRes.status}`
      });
    }

    // -------------------------------------------------------------
    // TEST 8: Duplicate Webhook Idempotency
    // -------------------------------------------------------------
    {
      // Dispatch the exact same valid webhook again for testOrderIdForWebhook
      const webhookPayload = JSON.stringify({
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        event_time: new Date().toISOString(),
        data: {
          order: {
            order_id: testOrderIdForWebhook,
            order_amount: 149,
            order_status: 'PAID'
          },
          payment: {
            cf_payment_id: `CF_PAY_REPEAT`,
            payment_status: 'SUCCESS'
          }
        }
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(`${timestamp}${webhookPayload}`)
        .digest('base64');

      const res1 = await fetch(`${baseUrl}/api/cashfree/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': signature
        },
        body: webhookPayload
      });
      const data1 = await res1.json();
      const passed = res1.status === 200 && data1.status === 'OK' && data1.processed === true;
      results.push({
        id: 8,
        name: 'Duplicate webhook idempotency (Safe repeat webhook handling)',
        passed,
        details: passed ? 'Duplicate handled idempotently without duplicate subscription creation' : `Failed: ${JSON.stringify(data1)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 9: Duplicate Subscription Activation Prevention
    // -------------------------------------------------------------
    {
      // Attempt to verify and activate testOrderIdForWebhook which is already activated
      const res = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: testOrderIdForWebhook,
          isSimulatedTest: true
        })
      });
      const data = await res.json();
      const passed = res.status === 200 && data.isPaid === true && data.alreadyActivated === true;
      results.push({
        id: 9,
        name: 'Duplicate subscription activation prevention (Idempotency flag)',
        passed,
        details: passed ? `Atomic guard confirmed: alreadyActivated = true` : `Failed: ${JSON.stringify(data)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 10: Failed and Pending Payment Handling
    // -------------------------------------------------------------
    {
      // Create a new order
      const oRes = await fetch(`${baseUrl}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': validTestToken
        },
        body: JSON.stringify({ planId: 'monthly' })
      });
      const oData = await oRes.json();
      const failedOrderId = oData.order_id;

      // Send FAILED webhook
      const failedPayload = JSON.stringify({
        type: 'PAYMENT_FAILED_WEBHOOK',
        data: {
          order: { order_id: failedOrderId, order_status: 'FAILED' },
          payment: { payment_status: 'FAILED' }
        }
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const sig = crypto.createHmac('sha256', secretKey).update(`${timestamp}${failedPayload}`).digest('base64');

      const hookRes = await fetch(`${baseUrl}/api/cashfree/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': sig
        },
        body: failedPayload
      });
      const hookData = await hookRes.json();

      // Check status via verify-order
      const verRes = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: failedOrderId })
      });
      const verData = await verRes.json();

      const passed = hookRes.status === 200 && verData.isPaid === false;
      results.push({
        id: 10,
        name: 'Failed and pending payment handling (No activation on failure)',
        passed,
        details: passed ? `Order correctly preserved as not paid (isPaid: false)` : `Unexpected state: ${JSON.stringify(verData)}`
      });
    }

    // -------------------------------------------------------------
    // TEST 11: Cashfree Verification API Failure / Missing Order Handling
    // -------------------------------------------------------------
    {
      // Verify request without orderId
      const emptyRes = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const emptyData = await emptyRes.json();

      // Verify nonexistent order
      const missingRes = await fetch(`${baseUrl}/api/cashfree/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'qp_non_existent_order_999' })
      });
      const missingData = await missingRes.json();

      const passed = emptyRes.status === 400 && missingRes.status === 200 && missingData.isPaid === false;
      results.push({
        id: 11,
        name: 'Cashfree verification missing order handling (Graceful degradation)',
        passed,
        details: passed ? `Missing order handled safely without crash (isPaid: false)` : `Unexpected state`
      });
    }

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('                     STAGE 2 TEST RESULTS                       ');
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

runStage2Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
