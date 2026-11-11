describe('application reset boundary', () => {
  const modulePath = '../../scripts/seed/resetApplicationData';

  afterEach(() => {
    jest.resetModules();
  });

  test('rejects reset without the exact confirmation token', () => {
    const { assertResetAuthorized } = require(modulePath);

    expect(() => assertResetAuthorized({ SEED_RESET_CONFIRM: 'yes' })).toThrow('SEED_RESET_CONFIRM');
    expect(() => assertResetAuthorized({ SEED_RESET_CONFIRM: 'RESET_DACN_DEMO' })).not.toThrow();
  });

  test('redacts database credentials when describing reset target', () => {
    const { describeDatabaseTarget } = require(modulePath);

    expect(describeDatabaseTarget('postgresql://alice:secret@db.example.edu:6543/dacn?sslmode=require'))
      .toEqual({ host: 'db.example.edu', port: '6543', database: 'dacn' });
  });

  test('rejects unsafe foreign-key dependents before truncate', async () => {
    const { assertNoExternalDependents } = require(modulePath);
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ schema_name: 'public', table_name: 'foreign_table' }]),
    };

    await expect(assertNoExternalDependents(prisma)).rejects.toThrow('foreign_table');
  });

  test('runs one explicit truncate after preflight succeeds', async () => {
    const { resetApplicationData } = require(modulePath);
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    };

    await resetApplicationData(prisma, { SEED_RESET_CONFIRM: 'RESET_DACN_DEMO' });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toMatch(/^TRUNCATE TABLE public\./);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('RESTART IDENTITY CASCADE');
  });

  test('includes all 12 BM02-BM04 phase 2 tables in APPLICATION_TABLES', () => {
    const { APPLICATION_TABLES } = require(modulePath);
    const requiredTables = [
      'topic_assignment_decisions',
      'topic_assignment_decision_items',
      'bm02a_adjustment_requests',
      'bm02a_form_versions',
      'electronic_signature_events',
      'title_adjustment_appendices',
      'title_adjustment_appendix_items',
      'bm03_progress_records',
      'bm03_meeting_entries',
      'bm03_stage_evaluations',
      'institute_stop_reviews',
      'institute_defense_reviews',
    ];
    for (const table of requiredTables) {
      expect(APPLICATION_TABLES).toContain(table);
    }
  });
});
