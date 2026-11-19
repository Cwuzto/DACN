/**
 * studentDashboardActionService.js
 *
 * Tính toán một bước tiếp theo duy nhất (nextAction) cho dashboard sinh viên
 * Đồng bộ trực tiếp từ studentWorkItemService.buildStudentWorkState.
 */

const { buildStudentWorkState } = require('./studentWorkItemService');

/**
 * Trả về hành động tiếp theo phù hợp nhất cho sinh viên.
 * Tái dùng 100% logic phân loại từ studentWorkItemService.
 *
 * @param {object} params
 * @param {object|null} params.registration
 * @param {object|null} params.semester
 * @param {Array} [params.tasks]
 * @param {object|null} [params.outline]
 * @param {object|null} [params.bm03Record]
 * @param {object|null} [params.bm04Record]
 * @param {object|null} [params.archive]
 * @param {object|null} [params.dossier]
 * @param {Array<string>} [params.allowedActions]
 * @param {Date} [params.now]
 * @returns {{ kind: string, title: string, description: string, dueAt: Date|string|null, target: string|null, sourceStatus: string|null, canAct: boolean } | null}
 */
function buildStudentNextAction({
    registration = null,
    semester = null,
    tasks = [],
    outline = null,
    bm03Record = null,
    bm04Record = null,
    archive = null,
    dossier = null,
    allowedActions = [],
    now = new Date(),
} = {}) {
    const state = buildStudentWorkState({
        registration,
        semester,
        tasks,
        outline,
        bm03Record,
        bm04Record,
        archive,
        dossier,
        allowedActions,
        now,
    });

    return state.nextAction;
}

module.exports = {
    buildStudentNextAction,
};
