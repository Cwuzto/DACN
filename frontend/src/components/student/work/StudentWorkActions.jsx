import React from 'react';
import StudentSubmissionActions from './StudentSubmissionActions';

/**
 * StudentWorkActions
 *
 * Điều phối hiển thị sub-action component tương ứng theo `item.kind` của work item.
 * - BM01 (v1/v2), BM02, BM02-A: Ủy quyền cho StudentSubmissionActions.
 * - BM03, BM04, Lưu chiểu (Archive): Ủy quyền trong Task 3 kế tiếp.
 *
 * @param {object} props
 * @param {object} props.item - Work item { id, kind, title, bucket, ... }
 * @param {object} props.registration - TopicRegistration (1 SV / 1 đề tài)
 * @param {object} [props.sources] - { tasks, outlineData, bm03Record, bm04Record, ... }
 * @param {Function} [props.onCompleted] - Callback sau khi nộp/sửa thành công
 */
export default function StudentWorkActions({ item, registration, sources = {}, onCompleted }) {
    if (!item) return null;

    const kind = item.kind || item.taskType || '';

    // BM01 Initial, BM01 Resubmission, BM02, and BM02-A submission actions
    const isSubmissionAction =
        kind === 'BM01_INITIAL' ||
        kind === 'SUBMIT_BM01' ||
        kind === 'BM01' ||
        kind === 'BM01_INITIAL_SUBMISSION' ||
        kind === 'BM01_RESUBMISSION' ||
        kind === 'RESUBMIT_BM01' ||
        kind === 'BM01_REVISION' ||
        kind === 'BM02' ||
        kind === 'SUBMIT_BM02' ||
        kind === 'BM02_SUBMISSION' ||
        kind === 'BM02_REVISION' ||
        kind === 'BM02_A' ||
        kind === 'BM02A' ||
        kind === 'TITLE_ADJUSTMENT' ||
        kind === 'REQUEST_TITLE_ADJUSTMENT' ||
        kind === 'DECISION_ISSUED';

    if (isSubmissionAction) {
        return (
            <StudentSubmissionActions
                item={item}
                registration={registration}
                sources={sources}
                onCompleted={onCompleted}
            />
        );
    }

    // Task 3 will hook up StudentProgressActions and StudentArchiveActions here.
    return null;
}
