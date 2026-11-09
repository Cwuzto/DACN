/**
 * Workload Interval Sweep Algorithm & Capacity Validation
 *
 * Implements authoritative half-open interval [startAt, endExclusive) sweep algorithms
 * to validate lecturer capacity across multiple overlapping project rounds and semesters.
 *
 * Core Business Rules:
 * 1. Maximum 10 students per lecturer at any point in time across the entire system.
 * 2. 1 student / 1 topic (maxStudents = 1).
 * 3. Half-open intervals: [startAt, endExclusive).
 *    When timestamps match, EXIT events (-W) MUST precede ENTER events (+W)
 *    so adjacent periods [T1, T2) and [T2, T3) do not falsely overlap at T2.
 */

const MAX_WORKLOAD_CAPACITY = 10;

/**
 * Formats a Date or date string to DD/MM (2-digit day and 2-digit month).
 * Uses 'Asia/Saigon' time zone when formatting Date instances to avoid UTC shift.
 *
 * @param {Date|string|number} date
 * @returns {string} Formatted DD/MM string
 */
function formatDateDDMM(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    if (/^\d{2}\/\d{2}$/.test(date)) return date;
    const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}`;
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Saigon',
      day: '2-digit',
      month: '2-digit'
    }).formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    if (day && month) return `${day}/${month}`;
  } catch (e) {
    // Fallback to local getters if Intl fails
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Formats diagnostic overload error message matching the required spec:
 * "Việc phân công này sẽ làm tải của giảng viên tăng từ ${currentPeak} lên ${newPeak} sinh viên trong khoảng ${dateStr} (${roundsStr}) nên không thể thực hiện."
 *
 * @param {Object} options
 * @param {string} [options.lecturerName]
 * @param {number} [options.currentPeak=10]
 * @param {number} [options.newPeak=11]
 * @param {Date|string} [options.peakStart]
 * @param {Date|string} [options.peakEnd]
 * @param {string[]|string} [options.conflictingRounds=[]]
 * @param {string} [options.dateStr]
 * @param {string} [options.roundsStr]
 * @returns {string} Formatted error message
 */
function formatWorkloadExceededMessage(options = {}) {
  const currentPeak = options.currentPeak !== undefined ? options.currentPeak : 10;
  const newPeak = options.newPeak !== undefined ? options.newPeak : currentPeak + 1;

  let dateStr = options.dateStr;
  if (!dateStr) {
    const startStr = formatDateDDMM(options.peakStart);
    const endStr = formatDateDDMM(options.peakEnd);
    dateStr = `${startStr}–${endStr}`;
  }

  let roundsStr = options.roundsStr;
  if (!roundsStr) {
    if (Array.isArray(options.conflictingRounds)) {
      roundsStr = options.conflictingRounds.join(', ');
    } else {
      roundsStr = String(options.conflictingRounds || '');
    }
  }

  return `Việc phân công này sẽ làm tải của giảng viên tăng từ ${currentPeak} lên ${newPeak} sinh viên trong khoảng ${dateStr} (${roundsStr}) nên không thể thực hiện.`;
}

/**
 * Core half-open interval sweep-line algorithm: [startAt, endExclusive).
 *
 * Timeline Event Sorting Rule:
 * 1. Primary: time ascending.
 * 2. Secondary: EXIT (-1) MUST precede ENTER (+1) when timestamps are identical.
 *
 * @param {Array<{ start: Date|string|number, end: Date|string|number, weight: number, roundName: string }>} intervals
 * @returns {{
 *   peakLoad: number,
 *   peakInterval: { start: Date, end: Date, semesterNames: string[] } | null
 * }}
 */
function sweepIntervals(intervals = []) {
  const events = [];

  for (const interval of intervals) {
    if (!interval) continue;
    const startMs = new Date(interval.start).getTime();
    const endMs = new Date(interval.end).getTime();
    const weight = Number(interval.weight) || 0;
    const roundName = interval.roundName || 'Không xác định';

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs || weight <= 0) {
      continue;
    }

    // ENTER event: type 1, weight +W
    events.push({
      time: startMs,
      type: 1,
      weight,
      roundName
    });

    // EXIT event: type -1, weight -W
    events.push({
      time: endMs,
      type: -1,
      weight: -weight,
      roundName
    });
  }

  if (events.length === 0) {
    return {
      peakLoad: 0,
      peakInterval: null
    };
  }

  // Sort events: time ascending, EXIT (-1) before ENTER (+1)
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.type - b.type;
  });

  const uniqueTimes = Array.from(new Set(events.map(e => e.time))).sort((a, b) => a - b);

  const eventsByTime = new Map();
  for (const event of events) {
    if (!eventsByTime.has(event.time)) {
      eventsByTime.set(event.time, []);
    }
    eventsByTime.get(event.time).push(event);
  }

  let runningLoad = 0;
  let peakLoad = 0;
  let peakInterval = null;
  const activeRoundsCount = new Map();

  for (let i = 0; i < uniqueTimes.length; i++) {
    const t = uniqueTimes[i];
    const timeEvents = eventsByTime.get(t) || [];

    // 1. Process all EXIT events at time t
    for (const ev of timeEvents) {
      if (ev.type === -1) {
        runningLoad += ev.weight;
        const currentCount = activeRoundsCount.get(ev.roundName) || 0;
        const newCount = currentCount - Math.abs(ev.weight);
        if (newCount <= 0) {
          activeRoundsCount.delete(ev.roundName);
        } else {
          activeRoundsCount.set(ev.roundName, newCount);
        }
      }
    }

    // 2. Process all ENTER events at time t
    for (const ev of timeEvents) {
      if (ev.type === 1) {
        runningLoad += ev.weight;
        const currentCount = activeRoundsCount.get(ev.roundName) || 0;
        activeRoundsCount.set(ev.roundName, currentCount + ev.weight);
      }
    }

    // 3. Interval [t, nextTime) has constant runningLoad
    if (i < uniqueTimes.length - 1) {
      const nextT = uniqueTimes[i + 1];
      if (runningLoad > peakLoad) {
        peakLoad = runningLoad;
        peakInterval = {
          start: new Date(t),
          end: new Date(nextT),
          semesterNames: Array.from(activeRoundsCount.keys())
        };
      } else if (runningLoad === peakLoad && peakInterval && peakInterval.end.getTime() === t && peakLoad > 0) {
        // Extend continuous peak interval
        peakInterval.end = new Date(nextT);
        for (const name of activeRoundsCount.keys()) {
          if (!peakInterval.semesterNames.includes(name)) {
            peakInterval.semesterNames.push(name);
          }
        }
      }
    }
  }

  return {
    peakLoad,
    peakInterval
  };
}

/**
 * Validates planned quota capacity across existing and proposed assignments.
 *
 * @param {Object} params
 * @param {Array<Object>} [params.existingAssignments=[]]
 * @param {Object} [params.newAssignment=null]
 * @returns {{
 *   valid: boolean,
 *   peakQuota: number,
 *   conflictingRounds: string[],
 *   peakInterval: { start: Date, end: Date } | null,
 *   message?: string
 * }}
 */
function validatePlannedQuotaSweep({ existingAssignments = [], newAssignment = null } = {}) {
  // Exclude CLOSED assignments and exclude the assignment matching newAssignment.id if updating
  const filteredExisting = existingAssignments.filter(assignment => {
    if (!assignment) return false;
    if (assignment.status === 'CLOSED') return false;
    if (newAssignment && newAssignment.id && assignment.id === newAssignment.id) {
      return false;
    }
    return true;
  });

  const existingIntervals = filteredExisting.map(assignment => {
    const sem = assignment.semester || assignment;
    return {
      start: sem.startDate || assignment.startDate,
      end: sem.endDate || assignment.endDate,
      weight: assignment.plannedQuota !== undefined ? Number(assignment.plannedQuota) : MAX_WORKLOAD_CAPACITY,
      roundName: sem.name || assignment.roundName || assignment.semesterName || assignment.name || 'Không xác định'
    };
  });

  // Calculate baseline peak before newAssignment
  const baselineResult = sweepIntervals(existingIntervals);
  const currentPeak = baselineResult.peakLoad;

  const allIntervals = [...existingIntervals];

  if (newAssignment && newAssignment.status !== 'CLOSED') {
    const sem = newAssignment.semester || newAssignment;
    allIntervals.push({
      start: sem.startDate || newAssignment.startDate,
      end: sem.endDate || newAssignment.endDate,
      weight: newAssignment.plannedQuota !== undefined ? Number(newAssignment.plannedQuota) : MAX_WORKLOAD_CAPACITY,
      roundName: sem.name || newAssignment.roundName || newAssignment.semesterName || newAssignment.name || 'Đợt mới'
    });
  }

  const combinedResult = sweepIntervals(allIntervals);
  const peakQuota = combinedResult.peakLoad;
  const isOverloaded = peakQuota > MAX_WORKLOAD_CAPACITY;

  if (isOverloaded) {
    const peakStart = combinedResult.peakInterval?.start;
    const peakEnd = combinedResult.peakInterval?.end;
    const conflictingRounds = combinedResult.peakInterval?.semesterNames || [];

    const message = formatWorkloadExceededMessage({
      currentPeak,
      newPeak: peakQuota,
      peakStart,
      peakEnd,
      conflictingRounds
    });

    return {
      valid: false,
      peakQuota,
      conflictingRounds,
      peakInterval: combinedResult.peakInterval ? {
        start: combinedResult.peakInterval.start,
        end: combinedResult.peakInterval.end
      } : null,
      message
    };
  }

  return {
    valid: true,
    peakQuota,
    conflictingRounds: [],
    peakInterval: combinedResult.peakInterval ? {
      start: combinedResult.peakInterval.start,
      end: combinedResult.peakInterval.end
    } : null
  };
}

/**
 * Calculates current and peak workload for a mentor across student registrations,
 * with optional candidate interval test.
 *
 * Student occupancy interval [startAt, endExclusive):
 * - ACTIVE: [max(startDate, effectiveAt), endDate)
 * - TRANSFERRED: [max(startDate, effectiveAt), transfer.effectiveAt)
 * - CANCELLED: [max(startDate, effectiveAt), cancelledAt || updatedAt)
 *
 * @param {Object} params
 * @param {Array<Object>} [params.existingRegistrations=[]]
 * @param {Object} [params.candidateInterval=null]
 * @param {Date|string|number} [params.now=new Date()]
 * @returns {{
 *   peakLoad: number,
 *   currentLoad: number,
 *   isExceeded: boolean,
 *   peakInterval: { start: Date, end: Date, semesterNames: string[] } | null
 * }}
 */
function calculateMentorPeakWorkload({ existingRegistrations = [], candidateInterval = null, now = new Date() } = {}) {
  const nowMs = now ? new Date(now).getTime() : Date.now();
  let currentLoad = 0;

  const intervals = [];

  for (const reg of existingRegistrations) {
    if (!reg) continue;
    const status = reg.assignmentStatus || reg.status || 'ACTIVE';
    const sem = reg.semester || reg.topic?.semester || reg;
    const semStart = sem.startDate ? new Date(sem.startDate) : null;
    const semEnd = sem.endDate ? new Date(sem.endDate) : null;

    const rawEffective = reg.effectiveAt || reg.createdAt;
    const effectiveAt = rawEffective ? new Date(rawEffective) : semStart;

    let startAt = semStart;
    if (semStart && effectiveAt) {
      startAt = new Date(Math.max(semStart.getTime(), effectiveAt.getTime()));
    } else if (effectiveAt) {
      startAt = effectiveAt;
    }

    let endExclusive = semEnd;
    if (status === 'TRANSFERRED') {
      const transEffective =
        reg.transfer?.effectiveAt ||
        reg.transferEffectiveAt ||
        reg.transferredAt ||
        reg.updatedAt ||
        reg.cancelledAt ||
        semEnd;
      endExclusive = transEffective ? new Date(transEffective) : semEnd;
    } else if (status === 'CANCELLED') {
      const cancelEffective = reg.cancelledAt || reg.updatedAt || semEnd;
      endExclusive = cancelEffective ? new Date(cancelEffective) : semEnd;
    }

    if (!startAt || !endExclusive) continue;
    const startMs = startAt.getTime();
    const endMs = endExclusive.getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      continue;
    }

    // Check if currently active at `now`
    if (startMs <= nowMs && nowMs < endMs) {
      currentLoad++;
    }

    const roundName = sem.name || reg.roundName || reg.semesterName || 'Không xác định';

    intervals.push({
      start: startAt,
      end: endExclusive,
      weight: 1,
      roundName
    });
  }

  // If candidate interval provided, add it
  if (candidateInterval) {
    const sem = candidateInterval.semester || candidateInterval;
    const rawStart = sem.startDate || candidateInterval.startDate || candidateInterval.start;
    const rawEnd = sem.endDate || candidateInterval.endDate || candidateInterval.end;
    const roundName = sem.name || candidateInterval.name || candidateInterval.roundName || candidateInterval.semesterName || 'Đợt mới';

    let startAt = rawStart ? new Date(rawStart) : null;
    if (candidateInterval.effectiveAt) {
      const effMs = new Date(candidateInterval.effectiveAt).getTime();
      if (!isNaN(effMs)) {
        startAt = new Date(Math.max(startAt ? startAt.getTime() : effMs, effMs));
      }
    } else if (candidateInterval.clampToNow && now) {
      startAt = new Date(Math.max(startAt ? startAt.getTime() : nowMs, nowMs));
    }

    const endExclusive = rawEnd ? new Date(rawEnd) : null;

    if (startAt && endExclusive && endExclusive.getTime() > startAt.getTime()) {
      intervals.push({
        start: startAt,
        end: endExclusive,
        weight: 1,
        roundName
      });
    }
  }

  const sweep = sweepIntervals(intervals);
  const peakLoad = sweep.peakLoad;
  const isExceeded = peakLoad > MAX_WORKLOAD_CAPACITY;

  return {
    peakLoad,
    currentLoad,
    isExceeded,
    peakInterval: sweep.peakInterval
  };
}

module.exports = {
  MAX_WORKLOAD_CAPACITY,
  formatDateDDMM,
  formatWorkloadExceededMessage,
  sweepIntervals,
  validatePlannedQuotaSweep,
  calculateMentorPeakWorkload
};
