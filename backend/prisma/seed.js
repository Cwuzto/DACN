require('dotenv').config();

const { runPhase1Seed } = require('./seedPhase1');
const { runPhase2Seed } = require('./seedPhase2');
const { runThreeSemestersSeed } = require('./seedThreeSemesters');

async function main() {
  const phase = String(process.env.SEED_PHASE || '3').trim().toLowerCase();
  if (phase === '1' || phase === 'phase1') {
    console.log('[seed] SEED_PHASE=1 detected -> Running Phase 1 seed...');
    await runPhase1Seed();
    return;
  }

  if (phase === '2' || phase === 'phase2') {
    console.log('[seed] SEED_PHASE=2 detected -> Running Phase 2 seed...');
    await runPhase2Seed();
    return;
  }

  console.log('[seed] Running Three Semesters seed (300 SV, 20 GV, 3 Đợt đồ án: 2 COMPLETED, 1 ONGOING)...');
  await runThreeSemestersSeed();
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
