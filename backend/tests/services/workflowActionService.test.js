const { computeAllowedActions } = require('../../src/services/workflowActionService');

describe('workflowActionService', () => {
    describe('computeAllowedActions', () => {
        test('trả mảng rỗng nếu không có registration hoặc user', () => {
            expect(computeAllowedActions(null, null)).toEqual([]);
            expect(computeAllowedActions({}, null)).toEqual([]);
        });

        test('sinh viên ở trạng thái PENDING có thể CANCEL_REGISTRATION', () => {
            const registration = { id: 1, studentId: 10, status: 'PENDING', topic: { mentorId: 99 } };
            const user = { id: 10, role: 'STUDENT' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).toContain('CANCEL_REGISTRATION');
            expect(actions).not.toContain('SUBMIT_BM02');
        });

        test('chặn sinh viên CANCEL_REGISTRATION sau khi đã có Quyết định (DECISION_ISSUED)', () => {
            const registration = { id: 1, studentId: 10, status: 'DECISION_ISSUED', topic: { mentorId: 99 } };
            const user = { id: 10, role: 'STUDENT' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).not.toContain('CANCEL_REGISTRATION');
            expect(actions).toContain('REQUEST_TITLE_CHANGE');
        });

        test('sinh viên ở BM01_PASSED có action SUBMIT_BM02', () => {
            const registration = { id: 1, studentId: 10, status: 'BM01_PASSED', topic: { mentorId: 99 } };
            const user = { id: 10, role: 'STUDENT' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).toContain('SUBMIT_BM02');
        });

        test('sinh viên ở DEFENDED với điểm >= 5.0 có SUBMIT_ARCHIVE', () => {
            const registration = {
                id: 1,
                studentId: 10,
                status: 'DEFENDED',
                defenseResult: { finalScore: 7.5 },
                topic: { mentorId: 99 },
            };
            const user = { id: 10, role: 'STUDENT' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).toContain('SUBMIT_ARCHIVE');
        });

        test('sinh viên ở DEFENDED nhưng điểm < 5.0 KHÔNG có SUBMIT_ARCHIVE (INV-06)', () => {
            const registration = {
                id: 1,
                studentId: 10,
                status: 'DEFENDED',
                defenseResult: { finalScore: 4.2 },
                topic: { mentorId: 99 },
            };
            const user = { id: 10, role: 'STUDENT' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).not.toContain('SUBMIT_ARCHIVE');
        });

        test('GVHD có action duyệt đăng ký khi PENDING', () => {
            const registration = { id: 1, studentId: 10, status: 'PENDING', topic: { mentorId: 20 } };
            const user = { id: 20, role: 'LECTURER' };
            const actions = computeAllowedActions(registration, user);
            expect(actions).toContain('APPROVE_REGISTRATION');
            expect(actions).toContain('REJECT_REGISTRATION');
        });

        test('INV-11 & INV-20: Thành viên hội đồng được chấm điểm bảo vệ, nhưng GVHD TUYỆT ĐỐI BỊ CHẶN DÙ NẰM TRONG HỘI ĐỒNG', () => {
            const registration = {
                id: 1,
                studentId: 10,
                status: 'DEFENSE_READY',
                topic: { mentorId: 20 },
                defenseCouncil: {
                    members: [
                        { lecturerId: 20 }, // GVHD
                        { lecturerId: 30 }, // Giám khảo độc lập
                    ],
                },
            };

            // GVHD bị chặn
            const mentorUser = { id: 20, role: 'LECTURER' };
            expect(computeAllowedActions(registration, mentorUser)).not.toContain('GRADE_DEFENSE');

            // Giám khảo độc lập được phép
            const independentUser = { id: 30, role: 'LECTURER' };
            expect(computeAllowedActions(registration, independentUser)).toContain('GRADE_DEFENSE');
        });

        test('Viện trưởng có quyền ban hành QĐ khi BM02_SUBMITTED', () => {
            const registration = { id: 1, studentId: 10, status: 'BM02_SUBMITTED', topic: { mentorId: 20 } };
            const deanUser = { id: 99, role: 'LECTURER', permissions: ['PROJECT_ASSIGNMENT_PUBLISH'] };
            const actions = computeAllowedActions(registration, deanUser);
            expect(actions).toContain('ISSUE_DECISION');
        });

        test('Admin có quyền điều chuyển GVHD và mở/khóa điểm', () => {
            const registration = { id: 1, studentId: 10, status: 'DEFENSE_READY', topic: { mentorId: 20 } };
            const adminUser = { id: 1, role: 'ADMIN' };
            const actions = computeAllowedActions(registration, adminUser);
            expect(actions).toContain('TRANSFER_MENTOR');
            expect(actions).toContain('LOCK_DEFENSE_SCORES');
        });
    });
});
