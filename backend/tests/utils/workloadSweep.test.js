const {
  validatePlannedQuotaSweep,
  calculateMentorPeakWorkload,
  formatWorkloadExceededMessage,
  formatDateDDMM
} = require('../../src/utils/workloadSweep');

describe('Workload Interval Sweep & Capacity Validation (Task 2)', () => {
  describe('formatDateDDMM & formatWorkloadExceededMessage', () => {
    it('should format dates as DD/MM correctly', () => {
      expect(formatDateDDMM('2026-05-15')).toBe('15/05');
      expect(formatDateDDMM('2026-06-30')).toBe('30/06');
      expect(formatDateDDMM('15/05')).toBe('15/05');
      expect(formatDateDDMM(new Date('2026-05-15T00:00:00+07:00'))).toBe('15/05');
    });

    it('should format diagnostic error message matching the exact spec copy', () => {
      const message = formatWorkloadExceededMessage({
        lecturerName: 'TS. Nguyễn Văn A',
        currentPeak: 10,
        newPeak: 11,
        peakStart: '2026-05-15',
        peakEnd: '2026-06-30',
        conflictingRounds: ['ĐATN 2026.1', 'DACN Hè 2026']
      });

      expect(message).toBe(
        'Việc phân công này sẽ làm tải của giảng viên tăng từ 10 lên 11 sinh viên trong khoảng 15/05–30/06 (ĐATN 2026.1, DACN Hè 2026) nên không thể thực hiện.'
      );
    });

    it('should support Date instances and custom dateStr / roundsStr in message formatter', () => {
      const message = formatWorkloadExceededMessage({
        currentPeak: 10,
        newPeak: 11,
        peakStart: new Date('2026-05-15T00:00:00+07:00'),
        peakEnd: new Date('2026-06-30T00:00:00+07:00'),
        conflictingRounds: ['Đợt 1', 'Đợt 2']
      });

      expect(message).toContain('15/05–30/06');
      expect(message).toContain('(Đợt 1, Đợt 2)');
      expect(message).toContain('tăng từ 10 lên 11 sinh viên');
    });
  });

  describe('validatePlannedQuotaSweep', () => {
    it('should accept non-overlapping periods without false overlap (Round A Jan-Apr, Round C May-Aug)', () => {
      const existingAssignments = [
        {
          id: 1,
          plannedQuota: 10,
          status: 'ACTIVE',
          semester: {
            name: 'Đợt 1 (Xuân)',
            startDate: new Date('2026-01-01T00:00:00+07:00'),
            endDate: new Date('2026-04-30T23:59:59+07:00')
          }
        }
      ];

      const newAssignment = {
        plannedQuota: 10,
        status: 'ACTIVE',
        semester: {
          name: 'Đợt 2 (Hè)',
          startDate: new Date('2026-05-01T00:00:00+07:00'),
          endDate: new Date('2026-08-31T23:59:59+07:00')
        }
      };

      const result = validatePlannedQuotaSweep({ existingAssignments, newAssignment });
      expect(result.valid).toBe(true);
      expect(result.peakQuota).toBe(10);
      expect(result.conflictingRounds).toEqual([]);
    });

    it('should detect peak of 10 and reject 11th on overlapping periods (Round A Jan-Jun 6, Round B May-Aug 4 -> +1 exceeds)', () => {
      const existingAssignments = [
        {
          id: 1,
          plannedQuota: 6,
          status: 'ACTIVE',
          semester: {
            name: 'ĐATN 2026.1',
            startDate: new Date('2026-01-01T00:00:00+07:00'),
            endDate: new Date('2026-06-30T23:59:59+07:00')
          }
        },
        {
          id: 2,
          plannedQuota: 4,
          status: 'ACTIVE',
          semester: {
            name: 'DACN Hè 2026',
            startDate: new Date('2026-05-15T00:00:00+07:00'),
            endDate: new Date('2026-08-31T23:59:59+07:00')
          }
        }
      ];

      // Existing peak is 10 in [2026-05-15, 2026-06-30]
      const validCheck = validatePlannedQuotaSweep({ existingAssignments });
      expect(validCheck.valid).toBe(true);
      expect(validCheck.peakQuota).toBe(10);

      // Attempting to add an assignment with 1 slot overlapping the peak period
      const newAssignment = {
        plannedQuota: 1,
        status: 'ACTIVE',
        semester: {
          name: 'Đồ án liên ngành',
          startDate: new Date('2026-05-20T00:00:00+07:00'),
          endDate: new Date('2026-07-20T23:59:59+07:00')
        }
      };

      const invalidResult = validatePlannedQuotaSweep({ existingAssignments, newAssignment });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.peakQuota).toBe(11);
      expect(invalidResult.conflictingRounds).toEqual(
        expect.arrayContaining(['ĐATN 2026.1', 'DACN Hè 2026', 'Đồ án liên ngành'])
      );
      expect(invalidResult.message).toContain('tăng từ 10 lên 11 sinh viên');
    });

    it('should handle adjacent periods [T1, T2) and [T2, T3) without overlap by sorting EXIT before ENTER', () => {
      const boundaryDate = new Date('2026-05-01T00:00:00+07:00');

      const existingAssignments = [
        {
          id: 1,
          plannedQuota: 10,
          status: 'ACTIVE',
          semester: {
            name: 'Kỳ 1',
            startDate: new Date('2026-01-01T00:00:00+07:00'),
            endDate: boundaryDate
          }
        }
      ];

      const newAssignment = {
        plannedQuota: 10,
        status: 'ACTIVE',
        semester: {
          name: 'Kỳ 2',
          startDate: boundaryDate, // exact same millisecond
          endDate: new Date('2026-09-01T00:00:00+07:00')
        }
      };

      const result = validatePlannedQuotaSweep({ existingAssignments, newAssignment });
      expect(result.valid).toBe(true);
      expect(result.peakQuota).toBe(10);
      expect(result.conflictingRounds).toEqual([]);
    });

    it('should ignore CLOSED assignments and properly replace quota when updating an existing assignment by id', () => {
      const existingAssignments = [
        {
          id: 1,
          plannedQuota: 10,
          status: 'CLOSED',
          semester: {
            name: 'Kỳ cũ đã đóng',
            startDate: new Date('2026-01-01T00:00:00+07:00'),
            endDate: new Date('2026-12-31T23:59:59+07:00')
          }
        },
        {
          id: 2,
          plannedQuota: 8,
          status: 'ACTIVE',
          semester: {
            name: 'Kỳ hiện tại',
            startDate: new Date('2026-01-01T00:00:00+07:00'),
            endDate: new Date('2026-06-30T23:59:59+07:00')
          }
        }
      ];

      // Updating id: 2 quota from 8 to 10 should succeed (not 8 + 10 = 18)
      const updateAssignment = {
        id: 2,
        plannedQuota: 10,
        status: 'ACTIVE',
        semester: {
          name: 'Kỳ hiện tại',
          startDate: new Date('2026-01-01T00:00:00+07:00'),
          endDate: new Date('2026-06-30T23:59:59+07:00')
        }
      };

      const result = validatePlannedQuotaSweep({ existingAssignments, newAssignment: updateAssignment });
      expect(result.valid).toBe(true);
      expect(result.peakQuota).toBe(10);
    });
  });

  describe('calculateMentorPeakWorkload', () => {
    const semA = {
      name: 'ĐATN 2026.1',
      startDate: new Date('2026-01-01T00:00:00+07:00'),
      endDate: new Date('2026-06-30T23:59:59+07:00')
    };

    const semB = {
      name: 'DACN Hè 2026',
      startDate: new Date('2026-05-15T00:00:00+07:00'),
      endDate: new Date('2026-08-31T23:59:59+07:00')
    };

    it('should calculate peak load correctly for overlapping student registrations', () => {
      // 6 active students in Round A
      const regsA = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: semA.startDate,
        semester: semA
      }));

      // 4 active students in Round B
      const regsB = Array.from({ length: 4 }, (_, i) => ({
        id: 10 + i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: semB.startDate,
        semester: semB
      }));

      const existingRegistrations = [...regsA, ...regsB];

      // Load on 2026-02-01 should be 6
      const febCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        now: new Date('2026-02-01T00:00:00+07:00')
      });
      expect(febCheck.currentLoad).toBe(6);
      expect(febCheck.peakLoad).toBe(10);
      expect(febCheck.isExceeded).toBe(false);

      // Load on 2026-06-01 should be 10 (intersection of Round A and B)
      const juneCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        now: new Date('2026-06-01T00:00:00+07:00')
      });
      expect(juneCheck.currentLoad).toBe(10);
      expect(juneCheck.peakLoad).toBe(10);
      expect(juneCheck.isExceeded).toBe(false);

      // Adding 11th candidate in Round B should exceed capacity
      const candidateCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        candidateInterval: {
          startDate: semB.startDate,
          endDate: semB.endDate,
          name: semB.name
        },
        now: new Date('2026-06-01T00:00:00+07:00')
      });

      expect(candidateCheck.peakLoad).toBe(11);
      expect(candidateCheck.isExceeded).toBe(true);
      expect(candidateCheck.peakInterval.semesterNames).toEqual(
        expect.arrayContaining(['ĐATN 2026.1', 'DACN Hè 2026'])
      );
    });

    it('should handle adjacent student occupancy intervals without false overload at boundary', () => {
      const boundary = new Date('2026-05-01T00:00:00+07:00');

      const regsRound1 = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: new Date('2026-01-01T00:00:00+07:00'),
        semester: {
          name: 'Đợt 1',
          startDate: new Date('2026-01-01T00:00:00+07:00'),
          endDate: boundary
        }
      }));

      const regsRound2 = Array.from({ length: 10 }, (_, i) => ({
        id: 20 + i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: boundary,
        semester: {
          name: 'Đợt 2',
          startDate: boundary,
          endDate: new Date('2026-09-01T00:00:00+07:00')
        }
      }));

      const result = calculateMentorPeakWorkload({
        existingRegistrations: [...regsRound1, ...regsRound2],
        now: boundary
      });

      expect(result.peakLoad).toBe(10);
      expect(result.isExceeded).toBe(false);
      // At boundary t = boundary, Round 1 exited (-10), Round 2 entered (+10), so currentLoad is exactly 10
      expect(result.currentLoad).toBe(10);
    });

    it('should release slot when student is TRANSFERRED mid-round at transfer effectiveAt', () => {
      const transferDate = new Date('2026-03-15T00:00:00+07:00');

      // 9 regular active students for the entire round
      const activeRegs = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: semA.startDate,
        semester: semA
      }));

      // 1 student transferred out on March 15
      const transferredReg = {
        id: 10,
        assignmentStatus: 'TRANSFERRED',
        effectiveAt: semA.startDate,
        transfer: {
          effectiveAt: transferDate
        },
        semester: semA
      };

      const existingRegistrations = [...activeRegs, transferredReg];

      // Before transfer (March 1): load is 10
      const beforeCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        now: new Date('2026-03-01T00:00:00+07:00')
      });
      expect(beforeCheck.currentLoad).toBe(10);
      expect(beforeCheck.peakLoad).toBe(10);
      expect(beforeCheck.isExceeded).toBe(false);

      // After transfer (April 1): load is 9
      const afterCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        now: new Date('2026-04-01T00:00:00+07:00')
      });
      expect(afterCheck.currentLoad).toBe(9);

      // Assigning a new student candidate starting April 1 should NOT exceed (9 + 1 = 10)
      const replacementCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        candidateInterval: {
          startDate: new Date('2026-04-01T00:00:00+07:00'),
          endDate: semA.endDate,
          name: semA.name
        }
      });
      expect(replacementCheck.peakLoad).toBe(10);
      expect(replacementCheck.isExceeded).toBe(false);

      // But assigning starting March 1 (before transfer) WOULD exceed (10 + 1 = 11)
      const earlyCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        candidateInterval: {
          startDate: new Date('2026-03-01T00:00:00+07:00'),
          endDate: semA.endDate,
          name: semA.name
        }
      });
      expect(earlyCheck.peakLoad).toBe(11);
      expect(earlyCheck.isExceeded).toBe(true);
    });

    it('should release slot when student registration is CANCELLED mid-round at cancelledAt', () => {
      const cancelDate = new Date('2026-03-20T00:00:00+07:00');

      const activeRegs = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: semA.startDate,
        semester: semA
      }));

      const cancelledReg = {
        id: 10,
        assignmentStatus: 'CANCELLED',
        effectiveAt: semA.startDate,
        cancelledAt: cancelDate,
        semester: semA
      };

      const existingRegistrations = [...activeRegs, cancelledReg];

      // After cancellation (March 25): load is 9
      const afterCancelCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        now: new Date('2026-03-25T00:00:00+07:00')
      });
      expect(afterCancelCheck.currentLoad).toBe(9);

      // Adding new student starting March 21 keeps peak at 10
      const validCheck = calculateMentorPeakWorkload({
        existingRegistrations,
        candidateInterval: {
          startDate: new Date('2026-03-21T00:00:00+07:00'),
          endDate: semA.endDate,
          name: semA.name
        }
      });
      expect(validCheck.peakLoad).toBe(10);
      expect(validCheck.isExceeded).toBe(false);
    });

    it('should respect startAt = max(semester.startDate, assignment.effectiveAt) when student assigned late', () => {
      const lateEffective = new Date('2026-02-15T00:00:00+07:00');

      const lateReg = {
        id: 1,
        assignmentStatus: 'ACTIVE',
        effectiveAt: lateEffective,
        semester: semA
      };

      // In January, load should be 0
      const janCheck = calculateMentorPeakWorkload({
        existingRegistrations: [lateReg],
        now: new Date('2026-01-15T00:00:00+07:00')
      });
      expect(janCheck.currentLoad).toBe(0);

      // In March, load should be 1
      const marCheck = calculateMentorPeakWorkload({
        existingRegistrations: [lateReg],
        now: new Date('2026-03-01T00:00:00+07:00')
      });
      expect(marCheck.currentLoad).toBe(1);
    });
  });
});
