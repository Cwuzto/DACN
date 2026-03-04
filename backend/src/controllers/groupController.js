const prisma = require('../config/database');
const { catchAsync } = require('../middlewares/errorHandler'); // Tạm bỏ nếu chưa có, dùng try/catch thủ công

// GET /api/groups/my-group
// Lấy thông tin nhóm hiện tại của sinh viên
const getMyGroup = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const membership = await prisma.groupMember.findFirst({
            where: { studentId },
            include: {
                group: {
                    include: {
                        topic: { include: { mentor: { select: { fullName: true } } } },
                        members: {
                            include: { student: { select: { id: true, fullName: true, email: true, code: true } } }
                        }
                    }
                }
            }
        });

        if (!membership) {
            return res.json({ success: true, data: null, message: 'Bạn chưa có nhóm.' });
        }

        res.json({ success: true, data: membership.group });
    } catch (error) {
        next(error);
    }
};

// POST /api/groups
// Sinh viên tạo nhóm mới
const createGroup = async (req, res, next) => {
    try {
        const { groupName, semesterId } = req.body;
        const leaderId = req.user.id;

        if (!groupName || !semesterId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp tên nhóm và học kỳ (semesterId)',
            });
        }

        // Kiểm tra sinh viên đã có nhóm trong học kỳ này chưa
        const existingMember = await prisma.groupMember.findFirst({
            where: {
                studentId: leaderId,
                group: { semesterId: Number(semesterId) }
            }
        });

        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã có hoặc đang chờ tham gia một nhóm trong học kỳ này.',
            });
        }

        // Tạo nhóm và gán leader
        const newGroup = await prisma.group.create({
            data: {
                groupName,
                semesterId: Number(semesterId),
                leaderId,
                members: {
                    create: {
                        studentId: leaderId,
                        status: 'ACCEPTED', // Trưởng nhóm tự động ACCEPTED
                        joinedAt: new Date()
                    }
                }
            },
            include: { members: true }
        });

        res.status(201).json({
            success: true,
            message: 'Tạo nhóm thành công',
            data: newGroup
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/groups/:id/invite
// Trưởng nhóm mời sinh viên khác
const inviteMember = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.id);
        const { studentEmail } = req.body; // Mời qua email
        const leaderId = req.user.id;

        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ success: false, message: 'Nhóm không tồn tại' });

        if (group.leaderId !== leaderId) {
            return res.status(403).json({ success: false, message: 'Chỉ trưởng nhóm mới có quyền mời thành viên.' });
        }

        const student = await prisma.user.findUnique({ where: { email: studentEmail } });
        if (!student || student.role !== 'STUDENT') {
            return res.status(400).json({ success: false, message: 'Email sinh viên không hợp lệ.' });
        }

        // Kiểm tra sinh viên kia đã có nhóm trong kỳ này chưa
        const existingMember = await prisma.groupMember.findFirst({
            where: {
                studentId: student.id,
                group: { semesterId: group.semesterId }
            }
        });

        if (existingMember) {
            return res.status(400).json({ success: false, message: 'Sinh viên này đã có nhóm trong học kỳ hiện tại.' });
        }

        // Tạo member với status INVITED
        const newInvite = await prisma.groupMember.create({
            data: {
                groupId,
                studentId: student.id,
                status: 'INVITED'
            },
            include: { student: { select: { id: true, fullName: true, email: true } } }
        });

        // Tự động tạo Notification
        await prisma.notification.create({
            data: {
                userId: student.id,
                title: 'Lời mời vào nhóm',
                content: `Bạn nhận được lời mời tham gia nhóm ${group.groupName}.`,
                type: 'INVITATION'
            }
        });

        res.json({
            success: true,
            message: 'Gửi lời mời thành công.',
            data: newInvite
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/groups/:id/accept
// Sinh viên chấp nhận hoặc từ chối lời mời
const handleInvitation = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.id);
        const studentId = req.user.id;
        const { action } = req.body; // 'ACCEPT' hoặc 'REJECT'

        if (!['ACCEPT', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Hành động không hợp lệ' });
        }

        const membership = await prisma.groupMember.findUnique({
            where: { groupId_studentId: { groupId, studentId } }
        });

        if (!membership || membership.status !== 'INVITED') {
            return res.status(400).json({ success: false, message: 'Không tìm thấy lời mời hợp lệ.' });
        }

        if (action === 'ACCEPT') {
            await prisma.groupMember.update({
                where: { groupId_studentId: { groupId, studentId } },
                data: { status: 'ACCEPTED', joinedAt: new Date() }
            });
            return res.json({ success: true, message: 'Bạn đã gia nhập nhóm thành công.' });
        } else {
            // Xóa lời mời nếu từ chối
            await prisma.groupMember.delete({
                where: { groupId_studentId: { groupId, studentId } }
            });
            return res.json({ success: true, message: 'Đã từ chối lời mời.' });
        }
    } catch (error) {
        next(error);
    }
};

// POST /api/groups/:id/register-topic
// Trưởng nhóm chốt đăng ký một đề tài đã duyệt
const registerTopic = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.id);
        const { topicId } = req.body;
        const leaderId = req.user.id;

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { where: { status: 'ACCEPTED' } } }
        });

        if (!group) return res.status(404).json({ success: false, message: 'Nhóm không tồn tại' });
        if (group.leaderId !== leaderId) {
            return res.status(403).json({ success: false, message: 'Chỉ trưởng nhóm mới được đăng ký đề tài.' });
        }
        if (group.topicId) {
            return res.status(400).json({ success: false, message: 'Nhóm đã có đề tài, không thể đăng ký lại.' });
        }

        const topic = await prisma.topic.findUnique({
            where: { id: Number(topicId) },
            include: { _count: { select: { groups: true } } }
        });

        if (!topic || topic.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Đề tài không tồn tại hoặc chưa được duyệt.' });
        }
        if (topic.semesterId !== group.semesterId) {
            return res.status(400).json({ success: false, message: 'Đề tài không thuộc học kỳ hiện tại.' });
        }
        if (topic._count.groups >= topic.maxGroups) {
            return res.status(400).json({ success: false, message: 'Đề tài này đã đủ số lượng nhóm đăng ký.' });
        }

        const updatedGroup = await prisma.group.update({
            where: { id: groupId },
            data: { topicId: topic.id }
        });

        res.json({
            success: true,
            message: 'Đăng ký đề tài thành công.',
            data: updatedGroup
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/groups
// Lấy danh sách nhóm (Admin / Lecturer)
const getAllGroups = async (req, res, next) => {
    try {
        const { semesterId, unassignedOnly } = req.query;
        const where = {};
        if (semesterId) {
            where.semesterId = parseInt(semesterId);
        }
        if (unassignedOnly === 'true') {
            where.councilId = null;
            where.topicId = { not: null }; // Chỉ lấy nhóm đã chọn đề tài
        }

        // NẾU ROLE = LECTURER, CHỈ LẤY NHỮNG NHÓM MÌNH HƯỚNG DẪN
        if (req.user.role === 'LECTURER') {
            where.topic = { mentorId: req.user.id };
        }

        const groups = await prisma.group.findMany({
            where,
            include: {
                topic: { select: { title: true } },
                leader: { select: { fullName: true } },
                _count: { select: { members: true } },
                tasks: { select: { status: true, dueDate: true } }
            },
            orderBy: { id: 'desc' }
        });

        // Tính toán tiến độ (progress) và trạng thái (trackingStatus)
        const groupsWithProgress = groups.map(group => {
            const tasks = group.tasks || [];
            if (tasks.length === 0) {
                return { ...group, progress: 0, trackingStatus: 'onTrack', tasks: undefined };
            }

            const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
            const progress = Math.round((completedTasks / tasks.length) * 100);

            let trackingStatus = 'onTrack';
            const now = new Date();

            // Nếu có task overdue -> delayed
            const hasOverdue = tasks.some(t => t.status === 'OVERDUE' || (t.dueDate && t.dueDate < now && t.status !== 'COMPLETED' && t.status !== 'SUBMITTED'));
            if (hasOverdue) {
                trackingStatus = 'delayed';
            } else if (progress < 40 && tasks.length > 2) {
                trackingStatus = 'atRisk'; // Ví dụ: tiến độ chậm
            }

            return { ...group, progress, trackingStatus, tasks: undefined };
        });

        res.json({ success: true, data: groupsWithProgress });
    } catch (error) {
        next(error);
    }
};
// DELETE /api/groups/:id/members/:studentId
// Trưởng nhóm xóa thành viên, hoặc thành viên tự rời nhóm
const removeMember = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.id);
        const targetStudentId = parseInt(req.params.studentId);
        const currentUserId = req.user.id;

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: true }
        });

        if (!group) return res.status(404).json({ success: false, message: 'Nhóm không tồn tại' });

        const isLeader = group.leaderId === currentUserId;
        const isSelf = targetStudentId === currentUserId;

        // Quyền: Phải là nhóm trưởng (xóa người khác) HOẶC tự xóa chính mình
        if (!isLeader && !isSelf) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa thành viên này.' });
        }

        // Nếu là trưởng nhóm tự xóa mình
        if (targetStudentId === group.leaderId) {
            if (group.members.length > 1) {
                return res.status(400).json({ success: false, message: 'Nhóm trưởng không thể rời nhóm khi vẫn còn thành viên khác. Vui lòng chuyển quyền hoặc xóa các thành viên khác trước.' });
            } else {
                // Nhóm chỉ còn 1 người là leader -> Xóa luôn nhóm
                await prisma.group.delete({ where: { id: groupId } });
                return res.json({ success: true, message: 'Bạn đã rời và giải tán nhóm thành công.' });
            }
        }

        // Xóa thành viên
        await prisma.groupMember.delete({
            where: { groupId_studentId: { groupId, studentId: targetStudentId } }
        });

        res.json({
            success: true,
            message: isSelf ? 'Bạn đã rời nhóm thành công.' : 'Đã xóa thành viên khỏi nhóm.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllGroups,
    getMyGroup,
    createGroup,
    inviteMember,
    handleInvitation,
    registerTopic,
    removeMember
};
