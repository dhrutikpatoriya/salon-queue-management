import '../config/environment.js';

try {
  const { db } = await import('../db/database.js');
  try {
    const { initializeCredentialSchema } = await import('../db/credentialSchema.js');
    const { bootstrapCredentials } = await import('../services/credentialService.js');
    initializeCredentialSchema();
    const count = await bootstrapCredentials(process.env.NODE_ENV === 'production');
    console.log(`Initialized ${count} missing accounts. Existing credentials were preserved.`);
  } finally {
    db.close();
  }
} catch {
  console.error('Credential initialization failed. Check database access and the bootstrap values for missing accounts.');
  process.exitCode = 1;
}
