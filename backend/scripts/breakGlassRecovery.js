/**
 * Break-Glass Emergency Recovery Script
 * 
 * Mục đích:
 * Cơ chế cứu hộ ngoài luồng (out-of-band) chỉ dùng để chống lockout quản trị viên
 * hoặc khóa khẩn cấp tài khoản admin nghi ngờ bị xâm phạm.
 * 
 * Quy tắc an toàn bắt buộc (Zero-Trust Admin):
 * 1. Chỉ áp dụng cho tài khoản role === 'ADMIN'.
 * 2. Chỉ khôi phục nhóm hệ thống kỹ thuật QUAN_TRI_VIEN.
 * 3. Tuyệt đối KHÔNG gán bất kỳ quyền học thuật, chấm điểm, khóa điểm, duyệt đạt/rớt.
 * 4. Bắt buộc có lý do (>= 15 ký tự) và mã xác nhận BREAK_GLASS_CONFIRM.
 * 5. Luôn ghi AuditLog bất biến và phát cảnh báo Notification hệ thống.
 * 
 * Sử dụng CLI:
 *   node backend/scripts/breakGlassRecovery.js --action=restore --target=admin@university.edu.vn --reason="Khôi phục quyền quản trị viên kỹ thuật sau sự cố" --confirm=BREAK_GLASS_CONFIRM
 *   node backend/scripts/breakGlassRecovery.js --action=lock --target=admin@university.edu.vn --reason="Khóa khẩn cấp tài khoản admin nghi ngờ bị lộ thông tin" --confirm=BREAK_GLASS_CONFIRM
 */

const defaultPrisma = require('../src/config/database');

const REQUIRED_CONFIRMATION = 'BREAK_GLASS_CONFIRM';
const MIN_REASON_LENGTH = 15;

const FORBIDDEN_ACADEMIC_CAPABILITIES = Object.freeze([
  'RESULT_LOCK',
  'DEFENSE_RESULT_APPROVE',
  'RESULT_PUBLISH',
  'RESULT_PUBLICATION_PUBLISH',
  'PROJECT_ASSIGNMENT_PUBLISH',
  'DECISION_AMENDMENT_SIGN',
  'DEFENSE_SCORE_SUBMIT',
  'PERMISSION_ASSIGN_ACADEMIC',
  'MENTOR_ASSIGN',
  'TOPIC_REVIEW',
  'OUTLINE_APPROVE',
  'BM02_REVIEW',
  'BM03_CHECKPOINT_DECIDE',
  'BM04_SUBMIT',
]);

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...values] = arg.slice(2).split('=');
      args[key] = values.join('=');
    }
  }
  return args;
};

const executeBreakGlassRecovery = async ({
  action = 'restore',
  targetEmail,
  reason,
  confirm,
  ipAddress = '127.0.0.1 (BreakGlass CLI)',
  prisma = defaultPrisma,
} = {}) => {
  // 1. Kiểm tra xác nhận an toàn
  if (confirm !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Mã xác nhận không hợp lệ. Cần truyền chính xác confirm: '${REQUIRED_CONFIRMATION}'.`,
    );
  }

  // 2. Kiểm tra tham số hành động
  const normalizedAction = (action || '').toLowerCase().trim();
  if (!['restore', 'lock'].includes(normalizedAction)) {
    throw new Error('Hành động không hợp lệ. Chỉ chấp nhận "restore" hoặc "lock".');
  }

  // 3. Kiểm tra email mục tiêu
  if (!targetEmail || typeof targetEmail !== 'string' || !targetEmail.includes('@')) {
    throw new Error('Email tài khoản mục tiêu không hợp lệ.');
  }

  // 4. Kiểm tra lý do bắt buộc
  const trimmedReason = (reason || '').trim();
  if (trimmedReason.length < MIN_REASON_LENGTH) {
    throw new Error(
      `Lý do kích hoạt cứu hộ khẩn cấp phải có tối thiểu ${MIN_REASON_LENGTH} ký tự để đảm bảo trách nhiệm giải trình.`,
    );
  }

  // 5. Kiểm tra tài khoản trong CSDL
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      permissionGroups: {
        include: {
          permissionGroup: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`Không tìm thấy tài khoản người dùng với email: ${targetEmail}`);
  }

  if (user.role !== 'ADMIN') {
    throw new Error(
      `Cơ chế Break-Glass chỉ áp dụng cho tài khoản vai trò ADMIN. Tài khoản ${targetEmail} có vai trò ${user.role}.`,
    );
  }

  if (normalizedAction === 'restore') {
    // 6. Tìm nhóm quyền hệ thống QUAN_TRI_VIEN
    const systemAdminGroup = await prisma.permissionGroup.findUnique({
      where: { code: 'QUAN_TRI_VIEN' },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!systemAdminGroup) {
      throw new Error('Không tìm thấy nhóm quyền hệ thống QUAN_TRI_VIEN trong CSDL.');
    }

    // Safeguard: Kiểm tra bất biến Zero-Trust Admin (Nhóm cứu hộ không được mang quyền học thuật)
    const groupPermCodes = (systemAdminGroup.permissions || [])
      .map((p) => p.permission?.code || p.code)
      .filter(Boolean);

    const violatingAcademicPerms = groupPermCodes.filter((code) =>
      FORBIDDEN_ACADEMIC_CAPABILITIES.includes(code),
    );

    if (violatingAcademicPerms.length > 0) {
      throw new Error(
        `NGUY HIỂM: Nhóm QUAN_TRI_VIEN chứa quyền học thuật trái phép (${violatingAcademicPerms.join(', ')}). Hủy bỏ cứu hộ để bảo vệ tính toàn vẹn học vụ.`,
      );
    }

    // 7. Thực hiện khôi phục trong Transaction
    await prisma.$transaction(async (tx) => {
      // Gán nhóm QUAN_TRI_VIEN nếu chưa có
      const alreadyHasGroup = (user.permissionGroups || []).some(
        (upg) => upg.permissionGroupId === systemAdminGroup.id || upg.permissionGroup?.code === 'QUAN_TRI_VIEN',
      );

      if (!alreadyHasGroup) {
        await tx.userPermissionGroup.create({
          data: {
            userId: user.id,
            permissionGroupId: systemAdminGroup.id,
          },
        });
      }

      // Kích hoạt tài khoản và tăng permissionVersion để vô hiệu hóa token cũ
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          permissionVersion: { increment: 1 },
        },
      });

      // Ghi AuditLog bất biến
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BREAK_GLASS_RECOVERY',
          entityType: 'User',
          entityId: String(user.id),
          details: {
            action: 'RESTORE_ADMIN_CORE',
            targetEmail,
            groupCode: 'QUAN_TRI_VIEN',
            reason: trimmedReason,
            restoredAt: new Date().toISOString(),
          },
          ipAddress,
        },
      });

      // Tạo cảnh báo Notification trong hệ thống
      await tx.notification.create({
        data: {
          userId: user.id,
          title: 'CẢNH BÁO: Kích hoạt khôi phục khẩn cấp (Break-Glass Recovery)',
          content: `Tài khoản ${targetEmail} vừa được khôi phục nhóm quyền kỹ thuật QUAN_TRI_VIEN qua cơ chế ngoài luồng. Lý do: "${trimmedReason}".`,
          type: 'SYSTEM',
        },
      });
    });

    return {
      success: true,
      action: 'restore',
      targetEmail,
      userId: user.id,
      restoredGroup: 'QUAN_TRI_VIEN',
      message: `Khôi phục thành công nhóm quyền QUAN_TRI_VIEN cho tài khoản ${targetEmail}. Đã ghi AuditLog và tăng permissionVersion.`,
    };
  }

  if (normalizedAction === 'lock') {
    // 8. Thực hiện khóa khẩn cấp tài khoản
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          permissionVersion: { increment: 1 },
        },
      });

      // Ghi AuditLog bất biến
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BREAK_GLASS_LOCK',
          entityType: 'User',
          entityId: String(user.id),
          details: {
            action: 'EMERGENCY_LOCK_ADMIN',
            targetEmail,
            reason: trimmedReason,
            lockedAt: new Date().toISOString(),
          },
          ipAddress,
        },
      });

      // Tạo cảnh báo Notification
      await tx.notification.create({
        data: {
          userId: user.id,
          title: 'CẢNH BÁO: Khóa khẩn cấp tài khoản (Break-Glass Lock)',
          content: `Tài khoản ${targetEmail} đã bị vô hiệu hóa khẩn cấp qua cơ chế Break-Glass. Lý do: "${trimmedReason}".`,
          type: 'SYSTEM',
        },
      });
    });

    return {
      success: true,
      action: 'lock',
      targetEmail,
      userId: user.id,
      message: `Đã khóa khẩn cấp tài khoản ${targetEmail}. Đã ghi AuditLog và tăng permissionVersion.`,
    };
  }
};

// CLI Entrypoint
if (require.main === module) {
  const args = parseArgs();
  executeBreakGlassRecovery({
    action: args.action || 'restore',
    targetEmail: args.target,
    reason: args.reason,
    confirm: args.confirm,
  })
    .then((result) => {
      console.log('✅ BREAK-GLASS SUCCESS:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ BREAK-GLASS ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = {
  executeBreakGlassRecovery,
  REQUIRED_CONFIRMATION,
  MIN_REASON_LENGTH,
  FORBIDDEN_ACADEMIC_CAPABILITIES,
};
