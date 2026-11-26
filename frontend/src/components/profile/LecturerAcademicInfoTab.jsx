import { useState } from 'react';
import { Tag, Alert, Input, Tooltip } from 'antd';
import {
    BankOutlined,
    IdcardOutlined,
    ReadOutlined,
    TeamOutlined,
    ScheduleOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';

const SUGGESTED_INTERESTS = [
    'Trí tuệ nhân tạo (AI)',
    'Học máy & Học sâu',
    'Xử lý ngôn ngữ tự nhiên (NLP)',
    'Thị giác máy tính (Computer Vision)',
    'Kỹ thuật phần mềm (Software Engineering)',
    'Kiến trúc Microservices & Cloud',
    'An toàn thông tin & Mạng máy tính',
    'Hệ thống thông tin quản lý',
    'Blockchain & Web3',
    'Internet of Things (IoT)',
    'Khoa học dữ liệu & Big Data',
];

function LecturerAcademicInfoTab({ user, editing, tempProfile, onFieldChange }) {
    const [customTagInput, setCustomTagInput] = useState('');

    const currentInterests = tempProfile.researchInterests || [
        'Kỹ thuật phần mềm (Software Engineering)',
        'Kiến trúc Microservices & Cloud',
        'Trí tuệ nhân tạo (AI)',
    ];

    const handleAddInterest = (interest) => {
        if (!currentInterests.includes(interest)) {
            const next = [...currentInterests, interest];
            onFieldChange('researchInterests', next);
        }
    };

    const handleRemoveInterest = (interest) => {
        const next = currentInterests.filter((item) => item !== interest);
        onFieldChange('researchInterests', next);
    };

    const handleCustomTagSubmit = () => {
        if (customTagInput.trim()) {
            handleAddInterest(customTagInput.trim());
            setCustomTagInput('');
        }
    };

    return (
        <div className="space-y-6">
            <Alert
                type="info"
                showIcon
                title="Thông tin học thuật & Công tác chính thức"
                description="Mã số cán bộ, học vị và đơn vị công tác được bảo trợ và xác thực từ CSDL Quản lý Nhân sự của Viện Công nghệ số — Trường Đại học Thủ Dầu Một."
                className="rounded-xl border-blue-200 bg-blue-50/70"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Academic Credentials & Faculty Identity */}
                <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                        <BankOutlined className="text-blue-600" />
                        Đơn vị công tác & Học vị
                    </h4>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Trường
                        </label>
                        <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                            <BankOutlined className="text-blue-600" />
                            Trường Đại học Thủ Dầu Một
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Đơn vị quản lý chuyên môn
                        </label>
                        <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                            <BankOutlined className="text-indigo-600" />
                            Viện Công nghệ số
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Bộ môn công tác
                        </label>
                        <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                            {tempProfile.department || 'Bộ môn Kỹ thuật phần mềm & Hệ thống thông tin'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Mã cán bộ
                            </label>
                            <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                                {tempProfile.employeeId || user?.code}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Học hàm / Học vị
                            </label>
                            <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                                <Tag color="cyan" className="m-0 font-semibold">
                                    {user?.academicTitle || 'TIEN_SI'}
                                </Tag>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Council & Academic Duties */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                        <ScheduleOutlined className="text-blue-600" />
                        Nhiệm vụ Hội đồng chuyên môn
                    </h4>

                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-slate-800">
                                    Hội đồng Xét duyệt Đề cương (BM01)
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    Thẩm định và xét duyệt đề cương nghiên cứu đầu đợt
                                </div>
                            </div>
                            <Tag color="success" icon={<CheckCircleOutlined />} className="m-0">
                                Sẵn sàng phân công
                            </Tag>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-slate-800">
                                    Hội đồng Chấm Bảo vệ Khóa luận (BM05)
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    Chủ tịch, Thư ký, Ủy viên phản biện đánh giá bảo vệ
                                </div>
                            </div>
                            <Tag color="success" icon={<CheckCircleOutlined />} className="m-0">
                                Sẵn sàng phân công
                            </Tag>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                                <TeamOutlined className="text-blue-600" />
                                Hạn mức hướng dẫn quy chuẩn
                            </div>
                            <p className="text-xs text-slate-600 m-0 leading-relaxed">
                                Theo Quy chế Đồ án tốt nghiệp Viện Công nghệ số: Mỗi Giảng viên hướng dẫn tối đa{' '}
                                <strong className="text-blue-700">10 sinh viên / đợt</strong> (mô hình 1 sinh viên / 1 đề tài độc lập).
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Research Interests & Specializations */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 m-0">
                        <ReadOutlined className="text-blue-600" />
                        Hướng nghiên cứu & Lĩnh vực chuyên sâu {editing && '(Có thể chỉnh sửa)'}
                    </h4>
                    <span className="text-xs text-slate-400">
                        Giúp sinh viên tra cứu và chọn GVHD phù hợp nguyện vọng
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    {currentInterests.map((interest, idx) => (
                        <Tag
                            key={idx}
                            color="blue"
                            closable={editing}
                            onClose={() => handleRemoveInterest(interest)}
                            className="px-3 py-1 rounded-lg text-xs font-medium m-0 flex items-center gap-1"
                        >
                            {interest}
                        </Tag>
                    ))}
                </div>

                {editing && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                        <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            <InfoCircleOutlined className="text-blue-600" />
                            Gợi ý lĩnh vực chuyên môn phổ biến (Bấm để thêm):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {SUGGESTED_INTERESTS.filter((s) => !currentInterests.includes(s)).map(
                                (item, idx) => (
                                    <Tag
                                        key={idx}
                                        onClick={() => handleAddInterest(item)}
                                        className="cursor-pointer hover:border-blue-400 text-xs py-0.5 rounded m-0 bg-slate-50"
                                    >
                                        + {item}
                                    </Tag>
                                )
                            )}
                        </div>

                        <div className="flex items-center gap-2 pt-2 max-w-md">
                            <Input
                                size="small"
                                placeholder="Nhập thêm lĩnh vực khác rồi nhấn Enter"
                                value={customTagInput}
                                onChange={(e) => setCustomTagInput(e.target.value)}
                                onPressEnter={handleCustomTagSubmit}
                                className="text-xs rounded-lg"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LecturerAcademicInfoTab;

