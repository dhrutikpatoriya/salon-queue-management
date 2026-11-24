import { mock } from 'node:test';

if (process.env.NODE_ENV !== 'test' || !process.env.SALON_E2E_RUN_ID) {
  throw new Error('The browser test clock requires an isolated test run');
}

// 11:30 a.m. at the salon. Socket timers and browser deadlines still use real time.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T06:00:00Z') });
