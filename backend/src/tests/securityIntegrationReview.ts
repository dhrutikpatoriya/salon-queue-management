import { app } from '../app.js';
import { db } from '../db/database.js';
import { getQueueTicket, cancelQueueTicket, joinCustomerQueue } from '../services/queueService.js';
import { randomBytes } from 'node:crypto';

const DEV_TEST_SECRET = randomBytes(32).toString('hex');
process.env.DEV_TEST_SECRET = DEV_TEST_SECRET;
import { setupSocketIO, broadcastQueueUpdate } from '../socket/socketHandler.js';
import http from 'http';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const reviewResults: TestResult[] = [];

function recordTest(category: string, test: string, passed: boolean, details: string) {
  reviewResults.push({
    category,
    test,
    status: passed ? 'PASS' : 'FAIL',
    details
  });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] [${category}] ${test}: ${details}`);
}

// In-process mock dispatcher for Express app testing
function dispatch(
  expressApp: any,
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: any,
  socketRemoteAddress: string = '127.0.0.1'
) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    let statusCode = 200;
    const lowerHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      lowerHeaders[k.toLowerCase()] = v;
    }

    const req: any = {
      method,
      url,
      originalUrl: url,
      headers: lowerHeaders,
      socket: { remoteAddress: socketRemoteAddress },
      ip: socketRemoteAddress,
      hostname: socketRemoteAddress === '127.0.0.1' ? 'localhost' : 'external-host.com',
      get(name: string) {
        return lowerHeaders[name.toLowerCase()];
      },
      header(name: string) {
        return lowerHeaders[name.toLowerCase()];
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

    expressApp.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Route not found' } });
    });
  });
}

async function runSecurityIntegrationReview() {
  console.log('=====================================================');
  console.log('   STEP 3 SECURITY AND INTEGRATION REVIEW SUITE');
  console.log('=====================================================\n');

  // Setup clean DB environment for this run
  db.prepare(`DELETE FROM queue_services`).run();
  db.prepare(`DELETE FROM queue_entries`).run();
  db.prepare(`UPDATE barbers SET status = 'available', is_on_duty = 1`).run();

  // -------------------------------------------------------------
  // REVIEW 1: DUPLICATE PHONE SECURITY & CREDENTIAL ISOLATION
  // -------------------------------------------------------------
  try {
    // 1.1 Alice joins queue
    const aliceRes = await dispatch(app, 'POST', '/api/queue/join', {}, {
      customerName: 'Alice Sharma',
      phoneNumber: '9876543210',
      serviceIds: ['haircut'],
      barberPreference: 'any'
    });

    const aliceTicket = aliceRes.body.ticket;
    const aliceToken = aliceTicket?.accessToken;
    const isAliceCreated =
      aliceRes.status === 201 &&
      Boolean(aliceToken) &&
      aliceRes.body.isExistingSpot === false;

    recordTest(
      'Duplicate Phone Security',
      '1.1 Legitimate customer receives access token on creation',
      isAliceCreated,
      `Alice token generated: ${aliceTicket?.tokenDisplay}, status: ${aliceRes.status}`
    );

    // 1.2 Attacker Bob submits Alice's phone number without her access token
    const bobRes = await dispatch(app, 'POST', '/api/queue/join', {}, {
      customerName: 'Attacker Bob',
      phoneNumber: '9876543210', // Alice's phone!
      serviceIds: ['hair-spa'],
      barberPreference: 'ravi'
    });

    const bobBody = bobRes.body;
    const bobTicket = bobBody.ticket;

    const noTokenLeaked = bobTicket?.accessToken === undefined;
    const noNameLeaked = bobTicket?.customerName === undefined;
    const noPhoneLeaked = bobTicket?.phoneNumber === undefined;
    const isExistingTrue = bobBody.isExistingSpot === true;
    const notAuthorized = bobTicket?.isAuthorized === false;

    const pass1_2 =
      bobRes.status === 200 &&
      noTokenLeaked &&
      noNameLeaked &&
      noPhoneLeaked &&
      isExistingTrue &&
      notAuthorized;

    recordTest(
      'Duplicate Phone Security',
      '1.2 Caller with duplicate phone CANNOT obtain access token or PII',
      pass1_2,
      `accessToken leaked: ${!noTokenLeaked}, customerName leaked: ${!noNameLeaked}, isAuthorized: ${bobTicket?.isAuthorized}`
    );

    // 1.3 Attacker tries to cancel Alice's spot without access token
    const bobCancelNoToken = await dispatch(app, 'POST', `/api/queue/${aliceTicket.id}/cancel`);
    const pass1_3 = bobCancelNoToken.status === 401;

    recordTest(
      'Duplicate Phone Security',
      '1.3 Cancellation rejected with 401 when access token is missing',
      pass1_3,
      `HTTP status: ${bobCancelNoToken.status}, error: "${bobCancelNoToken.body?.error}"`
    );

    // 1.4 Attacker tries to cancel Alice's spot with a forged/guessed token
    const bobCancelForgedToken = await dispatch(
      app,
      'POST',
      `/api/queue/${aliceTicket.id}/cancel`,
      { 'x-access-token': 'attacker_guessed_secret_token_12345' }
    );
    const pass1_4 = bobCancelForgedToken.status === 403;

    recordTest(
      'Duplicate Phone Security',
      '1.4 Cancellation rejected with 403 when access token is invalid',
      pass1_4,
      `HTTP status: ${bobCancelForgedToken.status}, error: "${bobCancelForgedToken.body?.error}"`
    );

    // 1.5 Verify Alice's spot remains untouched in 'waiting' status
    const aliceTicketDb = db.prepare(`SELECT status FROM queue_entries WHERE id = ?`).get(aliceTicket.id) as any;
    const pass1_5 = aliceTicketDb?.status === 'waiting';

    recordTest(
      'Duplicate Phone Security',
      '1.5 Target ticket remains securely in waiting status',
      pass1_5,
      `Database status: ${aliceTicketDb?.status}`
    );

    // 1.6 Verify legitimate owner CAN cancel with valid access token
    const aliceValidCancel = await dispatch(
      app,
      'POST',
      `/api/queue/${aliceTicket.id}/cancel`,
      { 'x-access-token': aliceToken }
    );
    const pass1_6 =
      aliceValidCancel.status === 200 &&
      aliceValidCancel.body?.ticket?.status === 'cancelled';

    recordTest(
      'Duplicate Phone Security',
      '1.6 Legitimate owner can cancel spot with valid access token',
      pass1_6,
      `Cancelled status: ${aliceValidCancel.body?.ticket?.status}`
    );
  } catch (err: any) {
    recordTest('Duplicate Phone Security', 'Review 1 Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // REVIEW 2: GUESSED QUEUE ID AUTHORIZATION & IDOR PREVENTION
  // -------------------------------------------------------------
  try {
    const fakeId = 'q_guessed_attacker_id_99999';

    // 2.1 Viewing fake queue ID returns 404
    const getFake = await dispatch(app, 'GET', `/api/queue/${fakeId}`);
    const pass2_1 = getFake.status === 404;

    recordTest(
      'IDOR & Guessed ID Security',
      '2.1 Guessed queue ID returns 404 on status lookup',
      pass2_1,
      `HTTP status: ${getFake.status}`
    );

    // 2.2 Cancelling fake queue ID returns 401 (token missing) or 404
    const cancelFake = await dispatch(app, 'POST', `/api/queue/${fakeId}/cancel`);
    const pass2_2 = cancelFake.status === 401;

    recordTest(
      'IDOR & Guessed ID Security',
      '2.2 Guessed queue ID cannot be cancelled without token',
      pass2_2,
      `HTTP status: ${cancelFake.status}`
    );
  } catch (err: any) {
    recordTest('IDOR & Guessed ID Security', 'Review 2 Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // REVIEW 3: DEV-ONLY CALL CUSTOMER ENDPOINT HARDENING
  // -------------------------------------------------------------
  try {
    // Create a new waiting customer for dev test
    const newCust = joinCustomerQueue({
      customerName: 'Dev Test Target',
      phoneNumber: '9123456789',
      serviceIds: ['haircut'],
      barberPreference: 'any'
    });

    // 3.1 Unset / Default NODE_ENV guard: Completely 404 Not Found
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_DEV_TEST;
    const devUnsetEnv = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`,
      { 'x-dev-test': DEV_TEST_SECRET },
      { barberId: 'ravi' },
      '127.0.0.1'
    );
    const pass3_1 = devUnsetEnv.status === 404;

    recordTest(
      'Dev Endpoint Hardening',
      '3.1 Endpoint is 404 Not Found when NODE_ENV is unset/missing',
      pass3_1,
      `HTTP status: ${devUnsetEnv.status}`
    );

    // 3.2 Production guard: Completely 404 Not Found when NODE_ENV=production
    process.env.ENABLE_DEV_TEST = 'true';
    process.env.NODE_ENV = 'production';
    const devInProd = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`,
      { 'x-dev-test': DEV_TEST_SECRET },
      { barberId: 'ravi' },
      '127.0.0.1'
    );
    const pass3_2 = devInProd.status === 404;

    recordTest(
      'Dev Endpoint Hardening',
      '3.2 Endpoint is 404 Not Found when NODE_ENV=production',
      pass3_2,
      `HTTP status in production: ${devInProd.status}`
    );

    // Explicitly enable dev mode for testing dev checks
    process.env.ENABLE_DEV_TEST = 'true';
    process.env.NODE_ENV = 'development';

    // 3.3 Missing secret header returns 403 Forbidden
    const devNoHeader = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`
    );
    const pass3_3 = devNoHeader.status === 403;

    recordTest(
      'Dev Endpoint Hardening',
      '3.3 Missing x-dev-test secret header returns 403 Forbidden',
      pass3_3,
      `HTTP status: ${devNoHeader.status}`
    );

    // 3.4 Invalid dev secret returns 403 Forbidden
    const devWrongSecret = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`,
      { 'x-dev-test': 'completely_wrong_secret' }
    );
    const pass3_4 = devWrongSecret.status === 403;

    recordTest(
      'Dev Endpoint Hardening',
      '3.4 Invalid dev secret returns 403 Forbidden',
      pass3_4,
      `HTTP status: ${devWrongSecret.status}`
    );

    const shortcut = await dispatch(app, 'POST', `/api/dev/call-customer/${newCust.ticket.id}`, { 'x-dev-test': 'true' });
    recordTest('Dev Endpoint Hardening', 'Former shortcut header is rejected', shortcut.status === 403, `HTTP status: ${shortcut.status}`);

    delete process.env.ENABLE_DEV_TEST;
    const disabled = await dispatch(app, 'POST', `/api/dev/call-customer/${newCust.ticket.id}`, { 'x-dev-test': DEV_TEST_SECRET });
    recordTest('Dev Endpoint Hardening', 'Development requires explicit opt-in', disabled.status === 404, `HTTP status: ${disabled.status}`);
    process.env.ENABLE_DEV_TEST = 'true';

    // 3.5 Reject if request comes from external IP (non-localhost)
    const devExternalIp = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`,
      { 'x-dev-test': DEV_TEST_SECRET },
      { barberId: 'ravi' },
      '203.0.113.42' // Non-local external IP address
    );
    const pass3_5 = devExternalIp.status === 403;

    recordTest(
      'Dev Endpoint Hardening',
      '3.5 Non-localhost request returns 403 Forbidden',
      pass3_5,
      `HTTP status: ${devExternalIp.status}, error: "${devExternalIp.body?.error}"`
    );

    // 3.6 Localhost call with secret succeeds and transitions status
    const devSuccess = await dispatch(
      app,
      'POST',
      `/api/dev/call-customer/${newCust.ticket.id}`,
      { 'x-dev-test': DEV_TEST_SECRET },
      { barberId: 'ravi' },
      '127.0.0.1'
    );
    const pass3_6 =
      devSuccess.status === 200 &&
      devSuccess.body?.ticket?.status === 'called';

    recordTest(
      'Dev Endpoint Hardening',
      '3.6 Localhost call with secret succeeds and transitions status',
      pass3_6,
      `Status: ${devSuccess.body?.ticket?.status}, assignedBarber: ${devSuccess.body?.ticket?.assignedBarber}`
    );
  } catch (err: any) {
    recordTest('Dev Endpoint Hardening', 'Review 3 Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // REVIEW 4: SOCKET.IO BROADCAST PRIVACY (ZERO PII LEAKS)
  // -------------------------------------------------------------
  try {
    let capturedEvent = '';
    let capturedPayload: any = null;

    const mockHttpServer = http.createServer();
    const io = setupSocketIO(mockHttpServer);

    const originalEmit = io.emit.bind(io);
    io.emit = function (event: string, ...args: any[]): boolean {
      capturedEvent = event;
      capturedPayload = args[0];
      return originalEmit(event, ...args);
    };

    broadcastQueueUpdate();

    const isEventCorrect = capturedEvent === 'queue:updated';
    const payloadKeys = capturedPayload ? Object.keys(capturedPayload).sort() : [];
    const onlyGenericKeys =
      payloadKeys.length === 2 &&
      payloadKeys.includes('type') &&
      payloadKeys.includes('timestamp');

    const containsNoPii =
      !capturedPayload?.customerName &&
      !capturedPayload?.phoneNumber &&
      !capturedPayload?.accessToken &&
      !capturedPayload?.id &&
      !capturedPayload?.tokenDisplay;

    const pass4 = isEventCorrect && onlyGenericKeys && containsNoPii;

    recordTest(
      'Socket.IO Broadcast Privacy',
      '4.1 Socket.IO broadcasts contain ZERO customer PII or tokens',
      pass4,
      `Event: "${capturedEvent}", keys: [${payloadKeys.join(', ')}], PII free: ${containsNoPii}`
    );
  } catch (err: any) {
    recordTest('Socket.IO Broadcast Privacy', 'Review 4 Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // REVIEW 5: DAILY RESET & PERSISTENCE WITHOUT DATA DELETION
  // -------------------------------------------------------------
  try {
    // Clean DB specifically for clean multi-day test
    db.prepare(`DELETE FROM queue_services`).run();
    db.prepare(`DELETE FROM queue_entries`).run();

    // 5.1 Insert historical Day 1 records
    const day1Date = '2026-11-23';
    db.prepare(`
      INSERT INTO queue_entries (
        id, token_number, token_display, customer_name, phone_number,
        barber_preference, status, access_token, total_duration_minutes,
        total_price, created_date, created_at
      ) VALUES (
        'q_hist_01', 1, 'S-1', 'Yesterday Customer 1', '9000000001',
        'any', 'done', 'token_hist_01', 30, 150, ?, '2026-11-23T10:00:00.000Z'
      ), (
        'q_hist_02', 2, 'S-2', 'Yesterday Customer 2', '9000000002',
        'any', 'waiting', 'token_hist_02', 15, 80, ?, '2026-11-23T11:00:00.000Z'
      )
    `).run(day1Date, day1Date);

    // 5.2 Join on Day 2 (today)
    const day2Cust1 = joinCustomerQueue({
      customerName: 'Today Customer 1',
      phoneNumber: '9000000003',
      serviceIds: ['haircut'],
      barberPreference: 'any'
    });

    const isDay2Reset = day2Cust1.ticket.token_display === 'S-1' && day2Cust1.ticket.token_number === 1;

    // 5.3 Verify Day 1 records STILL exist in the database (never deleted)
    const day1Records = db.prepare(`SELECT COUNT(*) as count FROM queue_entries WHERE created_date = ?`).get(day1Date) as any;
    const day1Preserved = day1Records.count === 2;

    // 5.4 Verify customer who had a spot yesterday can join fresh today with the same phone
    const day2ReturnCustomer = joinCustomerQueue({
      customerName: 'Returning Customer',
      phoneNumber: '9000000001', // Same phone as yesterday's customer!
      serviceIds: ['haircut'],
      barberPreference: 'any'
    });

    const returningCustAccepted =
      day2ReturnCustomer.ticket.token_display === 'S-2' &&
      day2ReturnCustomer.isExisting === false;

    // 5.5 Verify SQLite database integrity
    const integrityCheck = db.pragma('integrity_check') as any;
    const dbHealthy = integrityCheck[0]?.integrity_check === 'ok';

    const pass5 = isDay2Reset && day1Preserved && returningCustAccepted && dbHealthy;

    recordTest(
      'Daily Reset & Persistence',
      '5.1 Token resets to S-1 daily while preserving historical records',
      pass5,
      `Day 2 token 1: ${day2Cust1.ticket.token_display}, Day 2 token 2: ${day2ReturnCustomer.ticket.token_display}, Day 1 rows preserved: ${day1Records.count}, SQLite integrity: ${integrityCheck[0]?.integrity_check}`
    );
  } catch (err: any) {
    recordTest('Daily Reset & Persistence', 'Review 5 Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n=====================================================');
  console.log('                 FINAL REVIEW REPORT');
  console.log('=====================================================');
  let allPass = true;
  for (const r of reviewResults) {
    if (r.status !== 'PASS') allPass = false;
  }
  console.log(`TOTAL SECURITY & INTEGRATION CHECKS: ${reviewResults.length}`);
  console.log(`OVERALL RESULT: ${allPass ? 'ALL TESTS PASSED' : 'FAILURES DETECTED'}`);
  console.log('=====================================================\n');

  if (!allPass) {
    process.exit(1);
  }
}

runSecurityIntegrationReview().catch((err) => {
  console.error('Security review execution error:', err);
  process.exit(1);
});
