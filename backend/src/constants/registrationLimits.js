const PENDING_REMINDER_DAYS = 3;
const AUTO_REJECT_PENDING_DAYS = 5;
const AUTO_REJECT_REASON_STALE = `Tu dong tu choi do qua ${AUTO_REJECT_PENDING_DAYS} ngay khong duoc phan hoi.`;
const AUTO_REJECT_REASON_DEADLINE = 'Tu dong tu choi do da qua han dang ky cua dot do an.';

module.exports = {
    PENDING_REMINDER_DAYS,
    AUTO_REJECT_PENDING_DAYS,
    AUTO_REJECT_REASON_STALE,
    AUTO_REJECT_REASON_DEADLINE,
};
