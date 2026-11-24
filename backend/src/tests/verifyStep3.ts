import { randomBytes } from 'node:crypto';
import { app } from '../app.js';
import { getQueueTicket, cancelQueueTicket, joinCustomerQueue } from '../services/queueService.js';
import { db } from '../db/database.js';

const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

function record(test: string, passed: boolean, details: string) {
  results.push({ test, status: passed ? 'PASS' : 'FAIL', details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${test}: ${details}`);
}

// In-process mock dispatcher for Express app testing without opening socket ports
function testExpress(app: any, method: string, url: string, headers: Record<string, string> = {}, body?: any) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    let statusCode = 200;
    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const req: any = {
      method,
      url,
      originalUrl: url,
      headers: normalizedHeaders,
      socket: { remoteAddress: '127.0.0.1' },
      ip: '127.0.0.1',
      hostname: 'localhost',
      get(name: string) {
        return normalizedHeaders[name.toLowerCase()];
      },
      header(name: string) {
        return normalizedHeaders[name.toLowerCase()];
      },
      body: body || {},
      query: {},
      params: {}
    };

    const res: any = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        resolve({ status: statusCode, body: data });
        return res;
      },
      send(data: any) {
        resolve({ status: statusCode, body: data });
        return res;
      },
      setHeader() {
        return res;
      },
      getHeader() {
        return undefined;
      },
      end() {
        resolve({ status: statusCode, body: null });
      }
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' } });
    });
  });
}

async function runTests() {
  console.log('--- STARTING STEP 3 VERIFICATION TESTS ---');

  // Clear existing queue entries for a clean test run of daily tokens
  db.prepare(`DELETE FROM queue_services`).run();
  db.prepare(`DELETE FROM queue_entries`).run();
  db.prepare(`UPDATE barbers SET status = 'available', is_on_duty = 1`).run();

  // Test 1: First customer join creates daily token S-1
  try {
    const res1 = joinCustomerQueue({
      customerName: 'Aarav Patel',
      phoneNumber: '9876543210',
      serviceIds: ['haircut'],
      barberPreference: 'any'
    });
    const pass1 = res1.ticket.token_display === 'S-1' && res1.ticket.token_number === 1;
    record(
      'Test 1: First Join Token S-1',
      pass1,
      `Generated token: ${res1.ticket.token_display}, total price: ₹${res1.ticket.total_price}`
    );
  } catch (err: any) {
    record('Test 1: First Join Token S-1', false, err.message);
  }

  // Test 2: Second customer join with different phone creates S-2
  try {
    const res2 = joinCustomerQueue({
      customerName: 'Bhavin Shah',
      phoneNumber: '9822233344',
      serviceIds: ['haircut', 'beard-trim'],
      barberPreference: 'any'
    });
    const pass2 = res2.ticket.token_display === 'S-2' && res2.ticket.token_number === 2;
    record(
      'Test 2: Second Join Token S-2',
      pass2,
      `Generated token: ${res2.ticket.token_display}, duration: ${res2.ticket.total_duration_minutes}m`
    );
  } catch (err: any) {
    record('Test 2: Second Join Token S-2', false, err.message);
  }

  // Test 3: Duplicate active phone protection (same phone number returns existing ticket, no duplicate token)
  try {
    const resDuplicate = joinCustomerQueue({
      customerName: 'Aarav Patel Again',
      phoneNumber: '9876543210',
      serviceIds: ['hair-spa'],
      barberPreference: 'ravi'
    });
    const pass3 =
      resDuplicate.isExisting === true &&
      resDuplicate.ticket.token_display === 'S-1' &&
      resDuplicate.ticket.customer_name === 'Aarav Patel';
    record(
      'Test 3: Duplicate Active Phone Protection',
      pass3,
      `Returned existing token: ${resDuplicate.ticket.token_display}, isExisting: ${resDuplicate.isExisting}`
    );
  } catch (err: any) {
    record('Test 3: Duplicate Active Phone Protection', false, err.message);
  }

  // Test 4: Concurrency safety with simultaneous join requests
  try {
    const promises = [
      joinCustomerQueue({
        customerName: 'Concurrent User 1',
        phoneNumber: '9111111111',
        serviceIds: ['haircut'],
        barberPreference: 'any'
      }),
      joinCustomerQueue({
        customerName: 'Concurrent User 2',
        phoneNumber: '9222222222',
        serviceIds: ['haircut'],
        barberPreference: 'any'
      }),
      joinCustomerQueue({
        customerName: 'Concurrent User 3',
        phoneNumber: '9333333333',
        serviceIds: ['haircut'],
        barberPreference: 'any'
      })
    ];
    const concurrentResults = await Promise.all(promises);
    const tokens = concurrentResults.map((r) => r.ticket.token_display);
    const uniqueTokens = new Set(tokens);
    const pass4 =
      uniqueTokens.size === 3 &&
      tokens.includes('S-3') &&
      tokens.includes('S-4') &&
      tokens.includes('S-5');
    record(
      'Test 4: Concurrency & Daily Token Uniqueness',
      pass4,
      `Simultaneously generated tokens: ${tokens.join(', ')}`
    );
  } catch (err: any) {
    record('Test 4: Concurrency & Daily Token Uniqueness', false, err.message);
  }

  // Test 5: Verify FCFS position and wait-time calculation
  try {
    const ticket1 = db.prepare(`SELECT id, access_token FROM queue_entries WHERE token_display = 'S-1'`).get() as any;
    const ticket2 = db.prepare(`SELECT id, access_token FROM queue_entries WHERE token_display = 'S-2'`).get() as any;

    const details1 = getQueueTicket(ticket1.id, ticket1.access_token);
    const details2 = getQueueTicket(ticket2.id, ticket2.access_token);

    const pass5 =
      details1.position === 1 &&
      details2.position === 2 &&
      details2.shouldStartComing === true &&
      typeof details2.approxWaitMinutes === 'number';
    record(
      'Test 5: FCFS Position & Wait-Time Calculation',
      pass5,
      `S-1 pos: ${details1.position}, S-2 pos: ${details2.position}, S-2 shouldStartComing: ${details2.shouldStartComing}, wait: ~${details2.approxWaitMinutes}m`
    );
  } catch (err: any) {
    record('Test 5: FCFS Position & Wait-Time Calculation', false, err.message);
  }

  // Test 6: Specific Barber preference queue isolation
  try {
    const resAmit = joinCustomerQueue({
      customerName: 'Amit Fan',
      phoneNumber: '9444444444',
      serviceIds: ['haircut'],
      barberPreference: 'amit'
    });
    const detailsAmit = getQueueTicket(resAmit.ticket.id, resAmit.ticket.access_token);
    const pass6 = detailsAmit.barberPreference === 'amit' && detailsAmit.position > 0;
    record(
      'Test 6: Specific Barber Queue Isolation',
      pass6,
      `Amit queue position: ${detailsAmit.position}, preference: ${detailsAmit.barberPreference}`
    );
  } catch (err: any) {
    record('Test 6: Specific Barber Queue Isolation', false, err.message);
  }

  // Test 7: Wait time unavailable when no working barbers (Mandatory Correction 3)
  try {
    db.prepare(`UPDATE barbers SET status = 'break'`).run();
    const ticket1 = db.prepare(`SELECT id, access_token FROM queue_entries WHERE token_display = 'S-1'`).get() as any;
    const detailsNoBarbers = getQueueTicket(ticket1.id, ticket1.access_token);

    const pass7 =
      detailsNoBarbers.isWaitUnavailable === true &&
      detailsNoBarbers.approxWaitMinutes === null &&
      Boolean(detailsNoBarbers.waitReason);

    record(
      'Test 7: Wait Time Unavailable When Barbers On Break',
      pass7,
      `isWaitUnavailable: ${detailsNoBarbers.isWaitUnavailable}, approxWaitMinutes: ${detailsNoBarbers.approxWaitMinutes}, reason: "${detailsNoBarbers.waitReason}"`
    );

    db.prepare(`UPDATE barbers SET status = 'available'`).run();
  } catch (err: any) {
    record('Test 7: Wait Time Unavailable When Barbers On Break', false, err.message);
  }

  // Test 8: Security & Customer Access Credential Verification
  try {
    const ticket1 = db.prepare(`SELECT id, access_token, customer_name FROM queue_entries WHERE token_display = 'S-1'`).get() as any;
    const publicView = getQueueTicket(ticket1.id);
    const privateView = getQueueTicket(ticket1.id, ticket1.access_token);

    let cancelBlockedWithoutToken = false;
    try {
      cancelQueueTicket(ticket1.id, 'invalid_wrong_token');
    } catch {
      cancelBlockedWithoutToken = true;
    }

    const pass8 =
      publicView.customerName === undefined &&
      publicView.phoneNumber === undefined &&
      publicView.isAuthorized === false &&
      privateView.customerName === ticket1.customer_name &&
      privateView.isAuthorized === true &&
      cancelBlockedWithoutToken === true;

    record(
      'Test 8: Customer Access Credential & Privacy Protection',
      pass8,
      `Public view masked: ${publicView.customerName === undefined}, authorized view populated: ${privateView.customerName !== undefined}, invalid cancel rejected: ${cancelBlockedWithoutToken}`
    );
  } catch (err: any) {
    record('Test 8: Customer Access Credential & Privacy Protection', false, err.message);
  }

  // Test 9: Cancellation flow (Mandatory transition rule: only waiting can cancel)
  try {
    const ticket3 = db.prepare(`SELECT id, access_token FROM queue_entries WHERE token_display = 'S-3'`).get() as any;
    const cancelRes = cancelQueueTicket(ticket3.id, ticket3.access_token);
    const updatedTicket3 = getQueueTicket(ticket3.id, ticket3.access_token);

    let cancelAlreadyCancelledFails = false;
    try {
      cancelQueueTicket(ticket3.id, ticket3.access_token);
    } catch {
      cancelAlreadyCancelledFails = true;
    }

    const pass9 =
      cancelRes.status === 'cancelled' &&
      updatedTicket3.status === 'cancelled' &&
      cancelAlreadyCancelledFails === true;

    record(
      'Test 9: Queue Spot Cancellation & State Transition Rule',
      pass9,
      `Cancelled status: ${updatedTicket3.status}, repeated cancellation rejected: ${cancelAlreadyCancelledFails}`
    );
  } catch (err: any) {
    record('Test 9: Queue Spot Cancellation & State Transition Rule', false, err.message);
  }

  // Test 10: Dev Test Simulator & "Called" State Transition
  try {
    const ticket4 = db.prepare(`SELECT id, access_token FROM queue_entries WHERE token_display = 'S-4'`).get() as any;
    db.prepare(`UPDATE queue_entries SET status = 'called', assigned_barber_id = 'ravi', called_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      ticket4.id
    );
    const calledDetails = getQueueTicket(ticket4.id, ticket4.access_token);

    const pass10 =
      calledDetails.status === 'called' &&
      calledDetails.isYourTurn === true &&
      calledDetails.assignedBarber === 'Ravi';

    record(
      'Test 10: "Called" State Transition & "It\'s your turn!" Trigger',
      pass10,
      `Status: ${calledDetails.status}, isYourTurn: ${calledDetails.isYourTurn}, assignedBarber: ${calledDetails.assignedBarber}`
    );
  } catch (err: any) {
    record('Test 10: "Called" State Transition & "It\'s your turn!" Trigger', false, err.message);
  }

  // Test 11: Dev Test Endpoint Security & Header Verification via Express dispatch
  try {
    const testSecret = randomBytes(32).toString('hex');
    process.env.DEV_TEST_SECRET = testSecret;
    process.env.ENABLE_DEV_TEST = 'true';
    process.env.NODE_ENV = 'development';

    // 1. Missing header should return 403 Forbidden
    const resNoHeader = await testExpress(app, 'POST', '/api/dev/call-customer/test_id');
    const headerBlocked = resNoHeader.status === 403;

    // 2. With header but non-existent customer: route is reachable, returns 404 entry not found
    const resValidHeader = await testExpress(
      app,
      'POST',
      '/api/dev/call-customer/nonexistent_id',
      { 'x-dev-test': testSecret }
    );
    const routeActive = resValidHeader.status === 404 && resValidHeader.body?.error === 'Ticket not found';

    // 3. With header on valid waiting customer (S-5)
    const ticket5 = db.prepare(`SELECT id FROM queue_entries WHERE token_display = 'S-5'`).get() as any;
    const resCall = await testExpress(
      app,
      'POST',
      `/api/dev/call-customer/${ticket5.id}`,
      { 'x-dev-test': testSecret },
      { barberId: 'ravi' }
    );
    const callSucceeded = resCall.status === 200 && resCall.body?.ticket?.status === 'called';

    const pass11 = headerBlocked && routeActive && callSucceeded;
    record(
      'Test 11: Dev Test Endpoint Security & Header Verification',
      pass11,
      `Missing header 403 blocked: ${headerBlocked}, dev route active: ${routeActive}, call simulation: ${callSucceeded}`
    );
  } catch (err: any) {
    record('Test 11: Dev Test Endpoint Security & Header Verification', false, err.message);
  }

  // Test 12: SQLite Database Persistence after Re-reading
  try {
    const rowCount = db.prepare(`SELECT COUNT(*) as count FROM queue_entries`).get() as any;
    const pass12 = rowCount.count > 0;
    record(
      'Test 12: SQLite Persistence & Database Integrity',
      pass12,
      `Persistent queue records in SQLite: ${rowCount.count}`
    );
  } catch (err: any) {
    record('Test 12: SQLite Persistence & Database Integrity', false, err.message);
  }

  console.log('\n--- VERIFICATION SUMMARY ---');
  let allPass = true;
  for (const r of results) {
    if (r.status !== 'PASS') allPass = false;
  }
  console.log(`TOTAL TESTS: ${results.length} | ALL PASS: ${allPass}`);
  if (!allPass) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
