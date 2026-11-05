const {
  executeBreakGlassRecovery,
  REQUIRED_CONFIRMATION,
  MIN_REASON_LENGTH,
  FORBIDDEN_ACADEMIC_CAPABILITIES,
} = require('../../scripts/breakGlassRecovery');

describe('Break-Glass Emergency Recovery Script', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      permissionGroup: {
        findUnique: jest.fn(),
      },
      userPermissionGroup: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };
  });

  test('từ chối khi mã confirm không chính xác', async () => {
    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'admin@university.edu.vn',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: 'WRONG_CODE',
        prisma: mockPrisma,
      }),
    ).rejects.toThrow(`Cần truyền chính xác confirm: '${REQUIRED_CONFIRMATION}'`);
  });

  test('từ chối khi lý do ngắn hơn 15 ký tự', async () => {
    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'admin@university.edu.vn',
        reason: 'Quá ngắn',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow(`tối thiểu ${MIN_REASON_LENGTH} ký tự`);
  });

  test('từ chối khi email không hợp lệ', async () => {
    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'not-an-email',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow('Email tài khoản mục tiêu không hợp lệ');
  });

  test('từ chối khi hành động không hợp lệ', async () => {
    await expect(
      executeBreakGlassRecovery({
        action: 'invalid_action',
        targetEmail: 'admin@university.edu.vn',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow('Hành động không hợp lệ. Chỉ chấp nhận "restore" hoặc "lock"');
  });

  test('từ chối khi không tìm thấy người dùng trong CSDL', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'nonexistent@university.edu.vn',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow('Không tìm thấy tài khoản người dùng');
  });

  test('từ chối khi tài khoản không phải vai trò ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 10,
      email: 'student@university.edu.vn',
      role: 'STUDENT',
    });

    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'student@university.edu.vn',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow('Cơ chế Break-Glass chỉ áp dụng cho tài khoản vai trò ADMIN');
  });

  test('từ chối và cảnh báo khi nhóm QUAN_TRI_VIEN bị nhiễm quyền học thuật trái phép', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@university.edu.vn',
      role: 'ADMIN',
      permissionGroups: [],
    });
    mockPrisma.permissionGroup.findUnique.mockResolvedValue({
      id: 100,
      code: 'QUAN_TRI_VIEN',
      permissions: [
        { permission: { code: 'USER_MANAGE' } },
        { permission: { code: 'DEFENSE_RESULT_APPROVE' } }, // Vi phạm Zero-Trust!
      ],
    });

    await expect(
      executeBreakGlassRecovery({
        action: 'restore',
        targetEmail: 'admin@university.edu.vn',
        reason: 'Khôi phục tài khoản quản trị viên kỹ thuật khẩn cấp',
        confirm: REQUIRED_CONFIRMATION,
        prisma: mockPrisma,
      }),
    ).rejects.toThrow('chứa quyền học thuật trái phép (DEFENSE_RESULT_APPROVE)');
  });

  test('thực hiện khôi phục thành công (restore): gán QUAN_TRI_VIEN, kích hoạt tài khoản, tăng version, ghi audit và notification', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@university.edu.vn',
      role: 'ADMIN',
      isActive: false,
      permissionGroups: [],
    });
    mockPrisma.permissionGroup.findUnique.mockResolvedValue({
      id: 100,
      code: 'QUAN_TRI_VIEN',
      permissions: [
        { permission: { code: 'USER_MANAGE' } },
        { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
      ],
    });

    const result = await executeBreakGlassRecovery({
      action: 'restore',
      targetEmail: 'admin@university.edu.vn',
      reason: 'Khôi phục tài khoản quản trị viên kỹ thuật sau sự cố cấu hình',
      confirm: REQUIRED_CONFIRMATION,
      prisma: mockPrisma,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('restore');
    expect(result.targetEmail).toBe('admin@university.edu.vn');

    // Kiểm tra gán nhóm QUAN_TRI_VIEN
    expect(mockPrisma.userPermissionGroup.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        permissionGroupId: 100,
      },
    });

    // Kiểm tra kích hoạt tài khoản và tăng version
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isActive: true,
        permissionVersion: { increment: 1 },
      },
    });

    // Kiểm tra ghi AuditLog bất biến
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        action: 'BREAK_GLASS_RECOVERY',
        entityType: 'User',
        entityId: '1',
        details: expect.objectContaining({
          action: 'RESTORE_ADMIN_CORE',
          targetEmail: 'admin@university.edu.vn',
          groupCode: 'QUAN_TRI_VIEN',
        }),
      }),
    });

    // Kiểm tra tạo Notification
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        title: expect.stringContaining('Break-Glass Recovery'),
        type: 'SYSTEM',
      }),
    });
  });

  test('thực hiện khóa khẩn cấp thành công (lock): vô hiệu hóa tài khoản, tăng version, ghi audit và notification', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@university.edu.vn',
      role: 'ADMIN',
      isActive: true,
    });

    const result = await executeBreakGlassRecovery({
      action: 'lock',
      targetEmail: 'admin@university.edu.vn',
      reason: 'Khóa khẩn cấp tài khoản admin nghi ngờ bị xâm nhập trái phép',
      confirm: REQUIRED_CONFIRMATION,
      prisma: mockPrisma,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('lock');

    // Kiểm tra vô hiệu hóa
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isActive: false,
        permissionVersion: { increment: 1 },
      },
    });

    // Kiểm tra ghi AuditLog
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        action: 'BREAK_GLASS_LOCK',
        entityType: 'User',
        entityId: '1',
      }),
    });

    // Kiểm tra tạo Notification
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        title: expect.stringContaining('Break-Glass Lock'),
        type: 'SYSTEM',
      }),
    });
  });
});
