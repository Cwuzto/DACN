const prisma = require('../config/database');

// GET /api/evaluations/grading-groups
// Lấy danh sách các nhóm mà giảng viên đang hướng dẫn (chấm điểm GVHD)
const getGradingGroups = async (req, res, next) => {
    try {
        const mentorId = req.user.id;

        // Lấy tất cả các nhóm thỏa mãn điều kiện:
        // 1. Phải có đề tài đăng ký
        // 2. Đề tài đó do giảng viên này hướng dẫn (topic.mentorId === mentorId)
        const groups = await prisma.group.findMany({
            where: {
                topic: { mentorId: mentorId }
            },
            include: {
                topic: { select: { title: true } },
                members: {
                    where: { status: 'ACCEPTED' },
                    include: {
                        student: { select: { id: true, fullName: true, code: true } } // Thông tin sinh viên
                    }
                }
            },
            orderBy: { id: 'desc' }
        });

        // Với mỗi sinh viên trong nhóm, lấy điểm Evaluation hiện tại (nếu có) do GVHD này chấm
        const enhancedGroups = await Promise.all(groups.map(async (group) => {
            const studentsWithEvaluation = await Promise.all(group.members.map(async (member) => {
                const evalRecord = await prisma.evaluation.findFirst({
                    where: {
                        groupId: group.id,
                        studentId: member.studentId,
                        evaluatorId: mentorId,
                        evaluationType: 'MENTOR_SCORE'
                    }
                });

                return {
                    id: member.student.id,
                    name: member.student.fullName,
                    code: member.student.code,
                    score: evalRecord ? evalRecord.score : null,
                    comments: evalRecord ? evalRecord.comments : ''
                };
            }));

            // Xác định trạng thái của nhóm: "Chưa xác nhận" hoặc "Đã lưu nháp" hoặc "Hoàn thành"
            // Giả định đơn giản: nếu tất cả đều có score thì là "Hoàn thành" / "Đã lưu", nếu không là "Chưa xác nhận"
            const allScored = studentsWithEvaluation.length > 0 && studentsWithEvaluation.every(s => s.score !== null);
            const status = allScored ? 'Đã lưu điểm' : 'Chưa xác nhận';
            const statusColor = allScored ? 'success' : 'warning';

            return {
                id: group.id,
                groupName: group.groupName,
                topic: group.topic?.title || 'Chưa đăng ký',
                students: studentsWithEvaluation,
                status: status,
                statusColor: statusColor,
                roleTag: 'Điểm GVHD',
                roleColor: 'purple'
            };
        }));

        res.json({ success: true, data: enhancedGroups });
    } catch (error) {
        next(error);
    }
};

// POST /api/evaluations
// Upsert (Cập nhật hoặc Thêm mới) điểm đánh giá cho một danh sách sinh viên
const submitEvaluations = async (req, res, next) => {
    try {
        const { groupId, evaluationType, evaluations } = req.body;
        const evaluatorId = req.user.id; // LECTURER or ADMIN

        if (!groupId || !evaluationType || !Array.isArray(evaluations)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu đầu vào không hợp lệ.' });
        }

        // Với mỗi phần tử trong mảng evaluations { studentId, score, comments }, thực hiện upsert
        const results = await Promise.all(evaluations.map(async (evalData) => {
            if (evalData.score === null || evalData.score === undefined) {
                return null; // Bỏ qua những sinh viên chưa chấm điểm
            }

            // Tìm evaluation dựa trên composite unique key hoặc manual lookup
            const existingEval = await prisma.evaluation.findFirst({
                where: {
                    groupId: parseInt(groupId),
                    studentId: parseInt(evalData.studentId),
                    evaluatorId: evaluatorId,
                    evaluationType: evaluationType
                }
            });

            if (existingEval) {
                // Update
                return await prisma.evaluation.update({
                    where: { id: existingEval.id },
                    data: {
                        score: parseFloat(evalData.score),
                        comments: evalData.comments || ''
                    }
                });
            } else {
                // Create
                return await prisma.evaluation.create({
                    data: {
                        groupId: parseInt(groupId),
                        studentId: parseInt(evalData.studentId),
                        evaluatorId: evaluatorId,
                        evaluationType: evaluationType,
                        score: parseFloat(evalData.score),
                        comments: evalData.comments || ''
                    }
                });
            }
        }));

        res.json({ success: true, message: 'Đã lưu điểm và nhận xét thành công.', data: results.filter(r => r !== null) });
    } catch (error) {
        next(error);
    }
};

// GET /api/evaluations/my-grades
// Lấy điểm của sinh viên đang truy cập
const getMyGrades = async (req, res, next) => {
    try {
        const studentId = req.user.id;

        // Tìm nhóm của sinh viên trong kỳ hiện tại (giả sử sinh viên chỉ có 1 nhóm đang active)
        const membership = await prisma.groupMember.findFirst({
            where: { studentId, status: 'ACCEPTED' },
            include: {
                group: {
                    include: {
                        topic: {
                            include: { mentor: { select: { fullName: true } } }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!membership || !membership.group) {
            return res.json({ success: true, data: { group: null, grades: [] } });
        }

        const groupId = membership.group.id;

        // Lấy tất cả các điểm của sinh viên này trong nhóm này
        const evaluations = await prisma.evaluation.findMany({
            where: {
                groupId,
                studentId
            },
            include: {
                evaluator: { select: { fullName: true, role: true } }
            }
        });

        res.json({
            success: true,
            data: {
                group: {
                    id: groupId,
                    groupName: membership.group.groupName,
                    topicTitle: membership.group.topic?.title || 'Chưa đăng ký',
                    mentorName: membership.group.topic?.mentor?.fullName || 'Chưa có',
                },
                grades: evaluations.map(e => ({
                    evaluationType: e.evaluationType,
                    score: e.score,
                    comments: e.comments,
                    evaluatorName: e.evaluator?.fullName || 'Hội đồng'
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getGradingGroups,
    submitEvaluations,
    getMyGrades
};
