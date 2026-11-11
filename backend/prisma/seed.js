require('dotenv').config();

const { runPhase1Seed } = require('./seedPhase1');
const { runPhase2Seed } = require('./seedPhase2');

async function main() {
  const phase = String(process.env.SEED_PHASE || '2').trim();
  if (phase === '1' || phase.toLowerCase() === 'phase1') {
    console.log('[seed] SEED_PHASE=1 detected -> Running Phase 1 seed...');
    await runPhase1Seed();
    return;
  }

  console.log('[seed] Running Phase 2 seed (default full BM02–BM04 & Defense workflow)...');
  await runPhase2Seed();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed] Failed:', error);
      process.exit(1);
    });
}

module.exports = { main };
