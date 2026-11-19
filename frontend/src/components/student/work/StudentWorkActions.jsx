import React from 'react';
import StudentSubmissionActions from './StudentSubmissionActions';
import StudentProgressActions from './StudentProgressActions';
import StudentArchiveActions from './StudentArchiveActions';

/**
 * StudentWorkActions
 *
 * Điều phối hiển thị sub-action component tương ứng theo `item.kind` của work item:
 * 1. BM01 (v1/v2), BM02, BM02-A -> StudentSubmissionActions
 * 2. BM03, Checkpoints, BM04 -> StudentProgressActions
 * 3. Hồ sơ sơ bộ trước bảo vệ, Lưu chiểu sau bảo vệ, Giấy xác nhận hoàn thành -> StudentArchiveActions
 *
 * @param {object} props
 * @param {object} props.item - Work item { id, kind, title, bucket, ... }
 * @param {object} props.registration - TopicRegistration (1 SV / 1 đề tài)
 * @param {object} [props.sources] - { tasks, outlineData, bm03Record, bm04Record, archive, dossier, checkpoints, meetingLogs, ... }
 * @param {Function} [props.onCompleted] - Callback sau khi nộp/sửa/xác nhận thành công
 */
export default function StudentWorkActions({ item, registration, sources = {}, onCompleted }) {
    if (!item) return null;

    const kind = item.kind || item.taskType || '';

    // 1. BM01 Initial, BM01 Resubmission, BM02, and BM02-A submission actions
    const isSubmissionAction =
        kind === 'BM01_INITIAL' ||
        kind === 'SUBMIT_BM01' ||
        kind === 'BM01' ||
        kind === 'BM01_INITIAL_SUBMISSION' ||
        kind === 'BM01_RESUBMISSION' ||
        kind === 'BM01_RESUBMIT' ||
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

    // 2. BM03, Checkpoints, and BM04 progress actions
    const isProgressAction =
        kind === 'BM03_ACK' ||
        kind === 'BM03_VIEW' ||
        kind === 'BM03' ||
        kind === 'BM03_APPEAL' ||
        kind === 'BM04_VIEW' ||
        kind === 'BM04' ||
        kind === 'CHECKPOINT_SUBMIT' ||
        kind === 'CHECKPOINT_VIEW' ||
        kind === 'CHECKPOINT' ||
        kind === 'CHECKPOINT_SIGN' ||
        (typeof kind === 'string' && kind.startsWith('BM03_CHECKPOINT'));

    if (isProgressAction) {
        return (
            <StudentProgressActions
                item={item}
                registration={registration}
                sources={sources}
                onCompleted={onCompleted}
            />
        );
    }

    // 3. Pre-defense and Archival actions
    const isArchiveAction =
        kind === 'PRE_DEFENSE_SUBMIT' ||
        kind === 'PRE_DEFENSE' ||
        kind === 'SUBMIT_ARCHIVE' ||
        kind === 'ARCHIVE_VIEW' ||
        kind === 'ARCHIVE' ||
        kind === 'ARCHIVE_SUBMISSION' ||
        kind === 'VIEW_GRADES_CERTIFICATE';

    if (isArchiveAction) {
        return (
            <StudentArchiveActions
                item={item}
                registration={registration}
                sources={sources}
                onCompleted={onCompleted}
            />
        );
    }

    // 4. Generic task submission fallback
    if (kind === 'TASK_SUBMISSION') {
        const taskType = item.task?.taskType || '';
        if (taskType.startsWith('BM03_CHECKPOINT')) {
            return (
                <StudentProgressActions
                    item={item}
                    registration={registration}
                    sources={sources}
                    onCompleted={onCompleted}
                />
            );
        }
        return (
            <StudentSubmissionActions
                item={item}
                registration={registration}
                sources={sources}
                onCompleted={onCompleted}
            />
        );
    }

    return null;
}
