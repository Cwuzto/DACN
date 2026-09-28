// src/pages/common/HomePage.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Tag, Input, Drawer, Button, message } from 'antd';
import {
    SearchOutlined,
    FileTextOutlined,
    UserOutlined,
    MailOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    ArrowRightOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    CalendarOutlined,
    ThunderboltOutlined,
    InfoCircleOutlined,
    CloseOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { announcementService } from '../../services/announcementService';
import userService from '../../services/userService';

// ─── Constants ──────────────────────────────────────────────
const CATEGORIES = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'ANNOUNCEMENT', label: 'Thông báo học vụ' },
    { key: 'NEWS', label: 'Tin tức & Sự kiện' },
];

const DEPARTMENTS = [
    'Tất cả bộ môn',
    'Kỹ thuật Phần mềm',
    'Khoa học Máy tính',
    'Mạng & An ninh Thông tin',
    'Hệ thống Thông tin',
    'Trí tuệ Nhân tạo',
];

// Lộ trình 6 chặng chuẩn Viện Công nghệ Số
const ROADMAP_STAGES = [
    {
        step: '01',
        title: 'Đăng Ký & Ghép Nối GVHD',
        subtitle: 'Khởi tạo đề tài',
        duration: 'Tuần 1 - 2',
        color: '#2563eb', // blue
        icon: 'person_add',
        summary: 'Sinh viên chọn đề tài từ danh sách công bố hoặc tự đề xuất, liên hệ giảng viên hướng dẫn (tối đa 10 SV/GV).',
        actors: 'Sinh viên, Giảng viên hướng dẫn',
        deliverables: 'Hồ sơ đăng ký đề tài trực tuyến',
        rules: 'Mỗi đề tài tối đa 1 sinh viên. GVHD phê duyệt trực tiếp trên cổng học vụ.',
    },
    {
        step: '02',
        title: 'Thẩm Định Đề Cương BM01 & BM02',
        subtitle: 'Xét duyệt đề cương',
        duration: 'Tuần 3 - 4',
        color: '#7c3aed', // purple
        icon: 'fact_check',
        summary: 'Nộp đề cương BM01 cho Hội đồng thẩm định. Tinh chỉnh thành BM02 trình Viện trưởng phê duyệt, hoặc xét cơ chế Miễn thẩm định (Bypass).',
        actors: 'Sinh viên, Hội đồng thẩm định, Viện trưởng',
        deliverables: 'Biểu mẫu BM01, BM02 đã ký số/phê duyệt',
        rules: 'Đề tài đạt yêu cầu hoặc được Miễn thẩm định sẽ chuyển sang trạng thái IN_PROGRESS để thực hiện.',
    },
    {
        step: '03',
        title: 'Thực Hiện & Giám Sát BM03',
        subtitle: 'Tiến độ 3 tầng',
        duration: 'Tuần 5 - 12',
        color: '#0284c7', // sky
        icon: 'trending_up',
        summary: 'Thực hiện nghiên cứu, gặp gỡ định kỳ với GVHD ghi nhận nhật ký (Meeting Logs) và hoàn thành 2 đợt Checkpoint tiến độ chính.',
        actors: 'Sinh viên, Giảng viên hướng dẫn',
        deliverables: 'Nhật ký gặp gỡ BM03, Báo cáo Checkpoint 1 & 2',
        rules: 'Quá 21 ngày không có buổi gặp GVHD hệ thống sẽ phát cảnh báo nguy cơ trên Radar học vụ.',
    },
    {
        step: '04',
        title: 'Đánh Giá Trước Bảo Vệ BM04',
        subtitle: 'Chốt điều kiện bảo vệ',
        duration: 'Tuần 13 - 14',
        color: '#d97706', // amber
        icon: 'verified',
        summary: 'GVHD lập Phiếu nhận xét BM04, đánh giá điểm hướng dẫn và đưa ra quyết định ĐỒNG Ý hoặc KHÔNG ĐỒNG Ý cho bảo vệ.',
        actors: 'Giảng viên hướng dẫn',
        deliverables: 'Biểu mẫu BM04 hoàn tất (COMPLETED)',
        rules: 'Chốt chặn bắt buộc: Chỉ sinh viên có BM04 ĐỒNG Ý mới được phân công vào Hội đồng bảo vệ.',
    },
    {
        step: '05',
        title: 'Hội Đồng Chấm Bảo Vệ',
        subtitle: 'Hội đồng 3 thành viên',
        duration: 'Tuần 15',
        color: '#059669', // emerald
        icon: 'gavel',
        summary: 'Bảo vệ trực tiếp trước Hội đồng gồm 3 giảng viên (Chủ tịch, Thư ký, Phản biện). Điểm tổng kết là trung bình cộng độc lập.',
        actors: 'Hội đồng bảo vệ, Sinh viên',
        deliverables: 'Phiếu chấm điểm điện tử, Khóa sổ điểm bảo vệ',
        rules: 'Bảo vệ đạt yêu cầu (Điểm TB >= 5.0) chuyển trạng thái sang DEFENDED.',
    },
    {
        step: '06',
        title: 'Lưu Chiểu & Cấp Giấy Xác Nhận',
        subtitle: 'Nghiệm thu & Tốt nghiệp',
        duration: 'Tuần 16',
        color: '#0d9488', // teal
        icon: 'workspace_premium',
        summary: 'Nộp quyển báo cáo, slide, mã nguồn, link video demo. Sau khi nghiệm thu chính thức, nhận Giấy Xác Nhận Hoàn Thành ĐATN.',
        actors: 'Sinh viên, Quản trị viên/Khoa',
        deliverables: 'Hồ sơ lưu chiểu toàn văn, Giấy xác nhận (Certificate)',
        rules: 'Trạng thái chuyển sang COMPLETED. Tự động cấp mã định danh duy nhất TDMU-DA-CERT-YYYY-XXXXX.',
    },
];

// Danh mục Biểu mẫu chuẩn BM01 - BM04
const FORM_GUIDES = [
    {
        code: 'BM01',
        title: 'Đề cương Đồ án Tốt nghiệp',
        badge: 'Đề cương chi tiết',
        color: '#2563eb',
        signer: 'Sinh viên lập, GVHD xác nhận',
        target: 'Hội đồng xét duyệt đề cương',
        deadline: 'Trước tuần thứ 3 của đợt đồ án',
        desc: 'Văn bản phác thảo mục tiêu, đối tượng, phạm vi nghiên cứu, phương pháp luận và kế hoạch thực hiện đồ án trong 15 tuần.',
    },
    {
        code: 'BM02',
        title: 'Đơn Đăng ký Đề tài Chính thức',
        badge: 'Quyết định giao đề tài',
        color: '#7c3aed',
        signer: 'Sinh viên, GVHD, Trưởng Khoa / Viện trưởng',
        target: 'Viện Công nghệ Số lưu trữ',
        deadline: 'Tuần thứ 4 sau khi chỉnh sửa đề cương',
        desc: 'Đơn đăng ký chính thức ghi nhận tên đề tài hoàn thiện sau góp ý của Hội đồng thẩm định, là căn cứ pháp lý công nhận đề tài.',
    },
    {
        code: 'BM03',
        title: 'Nhật ký Tiến độ & Checkpoint',
        badge: 'Theo dõi tiến độ',
        color: '#0284c7',
        signer: 'GVHD ghi chú, Sinh viên ký nhận',
        target: 'Lưu hồ sơ tiến độ đồ án',
        deadline: 'Cập nhật định kỳ 1 - 2 tuần/lần',
        desc: 'Ghi lại nhật ký các buổi gặp hướng dẫn thực tế, nhận xét công việc đã làm, phân công nhiệm vụ mới và đánh giá Checkpoint 1, Checkpoint 2.',
    },
    {
        code: 'BM04',
        title: 'Phiếu Nhận xét của GVHD',
        badge: 'Điều kiện bảo vệ',
        color: '#d97706',
        signer: 'Giảng viên hướng dẫn trực tiếp',
        target: 'Hội đồng chấm bảo vệ',
        deadline: 'Tuần thứ 13 (Trước ngày bảo vệ 7 ngày)',
        desc: 'Phiếu đánh giá tinh thần làm việc, kết quả nghiên cứu, điểm số quá trình và kết luận ĐỒNG Ý hoặc KHÔNG ĐỒNG Ý cho sinh viên bảo vệ trước hội đồng.',
    },
];

// Fallback dữ liệu mẫu Giảng viên chất lượng cao
const FALLBACK_LECTURERS = [
    {
        id: 101,
        fullName: 'TS. Nguyễn Văn Hùng',
        code: 'GV00101',
        academicTitle: 'TIEN_SI',
        department: 'Kỹ thuật Phần mềm',
        email: 'hungnv@tdmu.edu.vn',
        maxSlots: 10,
        mentoredTopics: [
            { id: 1, title: 'Ứng dụng Microservices và Kubernetes trong hệ thống thương mại điện tử' },
            { id: 2, title: 'Hệ thống tự động kiểm thử và tích hợp liên tục CI/CD cho dự án DevOps' },
        ],
        _count: { mentoredTopics: 6 },
    },
    {
        id: 102,
        fullName: 'PGS.TS. Trần Đình Khoa',
        code: 'GV00102',
        academicTitle: 'PHO_GIAO_SU',
        department: 'Trí tuệ Nhân tạo',
        email: 'khoatd@tdmu.edu.vn',
        maxSlots: 10,
        mentoredTopics: [
            { id: 3, title: 'Mô hình học sâu đa phương thức nhận dạng bất thường trong video giám sát' },
            { id: 4, title: 'Xử lý ngôn ngữ tự nhiên Tiếng Việt ứng dụng trong Chatbot học thuật' },
        ],
        _count: { mentoredTopics: 8 },
    },
    {
        id: 103,
        fullName: 'ThS. Hoàng Thị Lan',
        code: 'GV00103',
        academicTitle: 'THAC_SI',
        department: 'Khoa học Máy tính',
        email: 'lanht@tdmu.edu.vn',
        maxSlots: 8,
        mentoredTopics: [
            { id: 5, title: 'Nền tảng phân tích dữ liệu lớn thời gian thực với Apache Kafka và Spark' },
        ],
        _count: { mentoredTopics: 5 },
    },
    {
        id: 104,
        fullName: 'TS. Lê Đức Minh',
        code: 'GV00104',
        academicTitle: 'TIEN_SI',
        department: 'Mạng & An ninh Thông tin',
        email: 'minhld@tdmu.edu.vn',
        maxSlots: 10,
        mentoredTopics: [
            { id: 6, title: 'Phát hiện mã độc tống tiền (Ransomware) sử dụng kỹ thuật phân tích hành vi' },
            { id: 7, title: 'Kiến trúc bảo mật Zero Trust cho mạng doanh nghiệp phân tán' },
        ],
        _count: { mentoredTopics: 7 },
    },
    {
        id: 105,
        fullName: 'ThS. Phạm Quốc Bảo',
        code: 'GV00105',
        academicTitle: 'THAC_SI',
        department: 'Hệ thống Thông tin',
        email: 'baopq@tdmu.edu.vn',
        maxSlots: 8,
        mentoredTopics: [
            { id: 8, title: 'Xây dựng giải pháp ERP tinh gọn cho doanh nghiệp vừa và nhỏ' },
        ],
        _count: { mentoredTopics: 4 },
    },
    {
        id: 106,
        fullName: 'TS. Đỗ Thị Thu Trang',
        code: 'GV00106',
        academicTitle: 'TIEN_SI',
        department: 'Kỹ thuật Phần mềm',
        email: 'trangdtt@tdmu.edu.vn',
        maxSlots: 10,
        mentoredTopics: [
            { id: 9, title: 'Ứng dụng Blockchain trong truy xuất nguồn gốc chuỗi cung ứng nông sản' },
        ],
        _count: { mentoredTopics: 6 },
    },
];

const formatAcademicTitle = (title) => {
    switch (title) {
        case 'GIAO_SU': return 'GS.TS.';
        case 'PHO_GIAO_SU': return 'PGS.TS.';
        case 'TIEN_SI': return 'TS.';
        case 'THAC_SI': return 'ThS.';
        default: return 'ThS.';
    }
};

// ─── Sub-components ─────────────────────────────────────────

function StickyHeader({ user, navigate }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleAuthClick = () => {
        if (user) {
            const role = user.role?.toLowerCase() || 'student';
            navigate(`/${role}/dashboard`);
        } else {
            navigate('/login');
        }
    };

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <header
            className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 bg-white/95 backdrop-blur-md border-b border-slate-200/80 ${
                scrolled ? 'shadow-md shadow-slate-900/5' : 'shadow-sm'
            }`}
        >
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="flex items-center justify-between h-16 lg:h-20">
                    {/* Logo */}
                    <a
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <img
                            src="/tdmu-logo.png"
                            alt="TDMU Logo"
                            className="w-11 h-11 object-contain shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div>
                            <p className="font-extrabold text-sm text-[#002b49] leading-tight tracking-tight uppercase">
                                Trường Đại học Thủ Dầu Một
                            </p>
                            <p className="text-[11px] font-semibold text-blue-700 tracking-wider">
                                Viện Công nghệ Số — Cổng Đồ Án Tốt Nghiệp
                            </p>
                        </div>
                    </a>

                    {/* Nav Links - Desktop */}
                    <nav className="hidden lg:flex items-center gap-1">
                        <button
                            onClick={() => scrollToSection('roadmap-section')}
                            className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Lộ trình 6 chặng
                        </button>
                        <button
                            onClick={() => scrollToSection('lecturers-section')}
                            className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Giảng viên & Đề tài
                        </button>
                        <button
                            onClick={() => scrollToSection('forms-section')}
                            className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Biểu mẫu BM01-BM04
                        </button>
                        <button
                            onClick={() => scrollToSection('announcements-section')}
                            className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Thông báo
                        </button>
                        <button
                            onClick={() => scrollToSection('contact-section')}
                            className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Liên hệ
                        </button>
                    </nav>

                    {/* Auth Button */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAuthClick}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002b49] text-white text-sm font-bold rounded-xl hover:bg-blue-800 active:scale-[0.97] transition-all shadow-md shadow-blue-950/20"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                {user ? 'dashboard' : 'login'}
                            </span>
                            <span>{user ? 'Vào hệ thống' : 'Đăng nhập'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

function HeroSection({ navigate, user }) {
    const handleCTA = () => {
        if (user) {
            navigate(`/${(user.role || 'student').toLowerCase()}/dashboard`);
        } else {
            navigate('/login');
        }
    };

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="relative pt-32 pb-20 lg:pt-36 lg:pb-28 overflow-hidden bg-gradient-to-b from-slate-900 via-[#001c33] to-slate-900 text-white">
            {/* Background image & overlay grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <img
                    src="/tdmu-campus.jpg"
                    alt="Campus"
                    className="w-full h-full object-cover"
                />
            </div>
            <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none"
            />

            <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="max-w-3xl">
                    {/* Top Pill Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 backdrop-blur-md mb-6">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                            Nền Tảng Quản Lý Học Vụ Đồ Án Tốt Nghiệp 2026
                        </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.12] tracking-tight">
                        Số Hóa Toàn Diện{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300">
                            Đồ Án Tốt Nghiệp
                        </span>{' '}
                        Viện Công Nghệ Số
                    </h1>

                    <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
                        Chuẩn hóa toàn bộ vòng đời học vụ 6 giai đoạn: từ đăng ký ghép nối GVHD, phê duyệt đề cương,
                        giám sát tiến độ BM03, đánh giá điều kiện BM04, chấm bảo vệ hội đồng, đến nghiệm thu lưu chiểu và cấp Giấy xác nhận tốt nghiệp điện tử.
                    </p>

                    {/* CTA Actions */}
                    <div className="mt-9 flex flex-wrap items-center gap-4">
                        <button
                            onClick={handleCTA}
                            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-blue-500/25 text-sm sm:text-base"
                        >
                            <span>{user ? 'Vào bảng điều khiển' : 'Đăng nhập cổng học vụ'}</span>
                            <ArrowRightOutlined className="text-xs" />
                        </button>
                        <button
                            onClick={() => scrollToSection('lecturers-section')}
                            className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl border border-white/20 active:scale-[0.98] transition-all backdrop-blur-md text-sm sm:text-base"
                        >
                            <TeamOutlined />
                            <span>Khám phá Giảng viên & Đề tài</span>
                        </button>
                    </div>
                </div>

                {/* 4 Feature High-Impact Metric Cards */}
                <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                        <p className="text-3xl font-black text-blue-400 tracking-tight">100%</p>
                        <p className="text-xs font-bold text-white uppercase tracking-wider mt-1">Số Hóa Học Vụ</p>
                        <p className="text-xs text-slate-400 mt-0.5">Loại bỏ hoàn toàn giấy tờ thủ công</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                        <p className="text-3xl font-black text-teal-400 tracking-tight">6 Chặng</p>
                        <p className="text-xs font-bold text-white uppercase tracking-wider mt-1">Lộ Trình Chuẩn Hóa</p>
                        <p className="text-xs text-slate-400 mt-0.5">Từ đề cương đến cấp chứng nhận</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                        <p className="text-3xl font-black text-purple-400 tracking-tight">BM01 - 04</p>
                        <p className="text-xs font-bold text-white uppercase tracking-wider mt-1">Biểu Mẫu Đồng Bộ</p>
                        <p className="text-xs text-slate-400 mt-0.5">Kiểm soát tiến độ & chất lượng</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
                        <p className="text-3xl font-black text-amber-400 tracking-tight">1 - 10</p>
                        <p className="text-xs font-bold text-white uppercase tracking-wider mt-1">Tỷ Lệ Hướng Dẫn</p>
                        <p className="text-xs text-slate-400 mt-0.5">1 SV / đề tài, tối đa 10 SV / GVHD</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function RoadmapSection() {
    const [selectedStage, setSelectedStage] = useState(null);

    return (
        <section id="roadmap-section" className="py-20 bg-slate-50 border-b border-slate-200 scroll-mt-20">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="text-center max-w-2xl mx-auto mb-14">
                    <span className="text-xs font-black text-blue-700 tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                        Quy trình học vụ
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
                        Lộ Trình 6 Chặng Chuẩn Viện Công Nghệ Số
                    </h2>
                    <p className="text-slate-500 text-sm sm:text-base mt-2">
                        Bảo đảm tính minh bạch, công bằng và chặt chẽ qua từng mốc kiểm soát học vụ.
                    </p>
                </div>

                {/* 6 Stage Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ROADMAP_STAGES.map((st) => (
                        <div
                            key={st.step}
                            onClick={() => setSelectedStage(st)}
                            className="group bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span
                                        className="text-xs font-black px-2.5 py-1 rounded-lg text-white font-mono"
                                        style={{ backgroundColor: st.color }}
                                    >
                                        CHẶNG {st.step}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                        <CalendarOutlined />
                                        {st.duration}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug">
                                    {st.title}
                                </h3>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                    {st.subtitle}
                                </p>

                                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                                    {st.summary}
                                </p>
                            </div>

                            <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-800">
                                <span>Xem chi tiết quy định</span>
                                <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Chi Tiết Chặng */}
            <Modal
                open={Boolean(selectedStage)}
                onCancel={() => setSelectedStage(null)}
                footer={null}
                title={
                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs font-mono font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: selectedStage?.color }}
                        >
                            CHẶNG {selectedStage?.step}
                        </span>
                        <span className="font-bold text-slate-800">{selectedStage?.title}</span>
                    </div>
                }
                destroyOnHidden
            >
                {selectedStage && (
                    <div className="py-2 space-y-4 text-sm text-slate-700">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mục tiêu & Tóm tắt</p>
                            <p className="text-slate-800 font-medium leading-relaxed">{selectedStage.summary}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Thời gian thực hiện</p>
                                <p className="font-semibold text-slate-800 mt-1">{selectedStage.duration}</p>
                            </div>
                            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Chủ thể liên quan</p>
                                <p className="font-semibold text-slate-800 mt-1">{selectedStage.actors}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sản phẩm / Bàn giao</p>
                            <Tag color="cyan" className="text-xs font-medium px-2 py-1">
                                {selectedStage.deliverables}
                            </Tag>
                        </div>

                        <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
                                <InfoCircleOutlined />
                                Quy chuẩn bắt buộc
                            </p>
                            <p className="text-xs leading-relaxed">{selectedStage.rules}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </section>
    );
}

function FacultyDirectorySection() {
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedDept, setSelectedDept] = useState('Tất cả bộ môn');
    const [selectedLecturer, setSelectedLecturer] = useState(null);

    useEffect(() => {
        const fetchLecturers = async () => {
            try {
                setLoading(true);
                const res = await userService.getPublicLecturers();
                if (res?.success && res.data?.length > 0) {
                    setLecturers(res.data);
                } else {
                    setLecturers(FALLBACK_LECTURERS);
                }
            } catch {
                setLecturers(FALLBACK_LECTURERS);
            } finally {
                setLoading(false);
            }
        };

        fetchLecturers();
    }, []);

    // Lọc danh sách
    const filteredLecturers = useMemo(() => {
        return lecturers.filter((lec) => {
            const matchDept = selectedDept === 'Tất cả bộ môn' || (lec.department && lec.department.includes(selectedDept));
            const matchSearch = !search.trim() ||
                lec.fullName?.toLowerCase().includes(search.toLowerCase()) ||
                lec.code?.toLowerCase().includes(search.toLowerCase()) ||
                lec.department?.toLowerCase().includes(search.toLowerCase()) ||
                lec.mentoredTopics?.some((t) => t.title?.toLowerCase().includes(search.toLowerCase()));
            return matchDept && matchSearch;
        });
    }, [lecturers, selectedDept, search]);

    return (
        <section id="lecturers-section" className="py-20 bg-white border-b border-slate-200 scroll-mt-20">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <span className="text-xs font-black text-blue-700 tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            Đội ngũ khoa học
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
                            Giảng Viên Hướng Dẫn & Hướng Nghiên Cứu
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base mt-1">
                            Tra cứu hướng nghiên cứu chuyên sâu, học vị và định mức hướng dẫn của Giảng viên.
                        </p>
                    </div>

                    {/* Bộ lọc Bộ môn */}
                    <div className="flex flex-wrap gap-1.5">
                        {DEPARTMENTS.map((dept) => (
                            <button
                                key={dept}
                                onClick={() => setSelectedDept(dept)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                    selectedDept === dept
                                        ? 'bg-[#002b49] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {dept}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Thanh tìm kiếm thời gian thực */}
                <div className="mb-8">
                    <Input
                        size="large"
                        placeholder="Tìm kiếm theo tên Giảng viên, Mã GV, hoặc từ khóa nghiên cứu (AI, Cloud, IoT, Web, Security...)"
                        prefix={<SearchOutlined className="text-slate-400 mr-1" />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        className="rounded-xl border-slate-300 shadow-sm"
                    />
                </div>

                {/* Danh sách thẻ giảng viên */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-700 border-t-transparent" />
                    </div>
                ) : filteredLecturers.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <UserOutlined className="text-4xl text-slate-300 mb-2 block" />
                        <p className="text-slate-600 font-semibold">Không tìm thấy giảng viên phù hợp với từ khóa.</p>
                        <p className="text-slate-400 text-xs mt-1">Thử thay đổi bộ môn hoặc từ khóa tìm kiếm.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLecturers.map((lec) => {
                            const titleLabel = formatAcademicTitle(lec.academicTitle);
                            return (
                                <div
                                    key={lec.id}
                                    className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Avatar & Title */}
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-[#002b49] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-900/10">
                                                    {lec.fullName?.split(' ').pop()?.charAt(0) || 'G'}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-700 transition-colors">
                                                        {titleLabel} {lec.fullName}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 font-mono">{lec.code} • {lec.department || 'Viện Công nghệ Số'}</p>
                                                </div>
                                            </div>
                                            <Tag color="blue" className="font-semibold text-xs m-0">
                                                {titleLabel}
                                            </Tag>
                                        </div>

                                        {/* Quota & Email */}
                                        <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 font-medium">Hạn mức nhận SV:</span>
                                                <span className="font-bold text-slate-800">Tối đa {lec.maxSlots || 10} SV</span>
                                            </div>
                                            {lec.email && (
                                                <div className="flex items-center gap-1.5 text-slate-500 font-mono truncate">
                                                    <MailOutlined className="text-slate-400" />
                                                    <span className="truncate">{lec.email}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hướng nghiên cứu mẫu */}
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Hướng nghiên cứu & Đề tài gợi ý
                                            </p>
                                            <div className="space-y-1.5">
                                                {lec.mentoredTopics && lec.mentoredTopics.length > 0 ? (
                                                    lec.mentoredTopics.slice(0, 2).map((top) => (
                                                        <div
                                                            key={top.id}
                                                            className="text-xs text-slate-700 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100/60 line-clamp-1"
                                                        >
                                                            • {top.title}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">Đang cập nhật hướng nghiên cứu chuyên sâu.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <button
                                            onClick={() => setSelectedLecturer(lec)}
                                            className="text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors flex items-center gap-1"
                                        >
                                            <span>Xem hướng nghiên cứu</span>
                                            <ArrowRightOutlined className="text-[10px]" />
                                        </button>
                                        <span className="text-[11px] font-semibold text-slate-400">
                                            {lec._count?.mentoredTopics || 0} đề tài
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Chi Tiết Giảng Viên */}
            <Modal
                open={Boolean(selectedLecturer)}
                onCancel={() => setSelectedLecturer(null)}
                footer={null}
                title={
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-blue-700 text-lg" />
                        <span className="font-bold text-slate-800 text-base">
                            Thông Tin Giảng Viên Hướng Dẫn
                        </span>
                    </div>
                }
                destroyOnHidden
            >
                {selectedLecturer && (
                    <div className="py-2 space-y-4 text-sm text-slate-700">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
                                {selectedLecturer.fullName?.split(' ').pop()?.charAt(0) || 'G'}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-lg">
                                    {formatAcademicTitle(selectedLecturer.academicTitle)} {selectedLecturer.fullName}
                                </h4>
                                <p className="text-xs text-slate-500 font-mono">Mã GV: {selectedLecturer.code}</p>
                                <p className="text-xs text-blue-700 font-semibold mt-0.5">{selectedLecturer.department}</p>
                            </div>
                        </div>

                        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-1 text-xs">
                            <p><strong>Email liên hệ:</strong> <span className="font-mono">{selectedLecturer.email || '—'}</span></p>
                            <p><strong>Định mức hướng dẫn:</strong> Tối đa {selectedLecturer.maxSlots || 10} sinh viên/học kỳ</p>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Các đề tài & Hướng nghiên cứu đã công bố
                            </p>
                            <div className="space-y-2">
                                {selectedLecturer.mentoredTopics?.map((top) => (
                                    <div key={top.id} className="p-3 bg-white rounded-xl border border-slate-200">
                                        <p className="font-bold text-slate-800 text-xs mb-1">{top.title}</p>
                                        {top.description && (
                                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{top.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </section>
    );
}

function FormCenterSection() {
    const [selectedForm, setSelectedForm] = useState(null);

    const handleDownloadSample = (code) => {
        message.info(`Đang tải mẫu biểu ${code}... (Định dạng Word/PDF chuẩn TDMU)`);
    };

    return (
        <section id="forms-section" className="py-20 bg-slate-50 border-b border-slate-200 scroll-mt-20">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="text-center max-w-2xl mx-auto mb-14">
                    <span className="text-xs font-black text-blue-700 tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                        Văn bản & Biểu mẫu
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
                        Trung Tâm Biểu Mẫu Học Vụ BM01 - BM04
                    </h2>
                    <p className="text-slate-500 text-sm sm:text-base mt-2">
                        Tất cả các biểu mẫu chuẩn được số hóa, hỗ trợ nộp trực tuyến và ký số.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {FORM_GUIDES.map((f) => (
                        <div
                            key={f.code}
                            onClick={() => setSelectedForm(f)}
                            className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span
                                        className="text-xs font-black px-2.5 py-1 rounded-lg text-white font-mono"
                                        style={{ backgroundColor: f.color }}
                                    >
                                        {f.code}
                                    </span>
                                    <Tag color="default" className="text-[11px] font-semibold m-0">
                                        {f.badge}
                                    </Tag>
                                </div>

                                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                                    {f.title}
                                </h3>

                                <p className="text-xs text-slate-500 mt-2.5 line-clamp-3 leading-relaxed">
                                    {f.desc}
                                </p>
                            </div>

                            <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
                                <span>Xem hướng dẫn nộp</span>
                                <FileTextOutlined />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Chi Tiết Biểu Mẫu */}
            <Modal
                open={Boolean(selectedForm)}
                onCancel={() => setSelectedForm(null)}
                footer={null}
                title={
                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs font-mono font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: selectedForm?.color }}
                        >
                            {selectedForm?.code}
                        </span>
                        <span className="font-bold text-slate-800 text-base">{selectedForm?.title}</span>
                    </div>
                }
                destroyOnHidden
            >
                {selectedForm && (
                    <div className="py-2 space-y-4 text-sm text-slate-700">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mô tả mục đích</p>
                            <p className="text-slate-800 leading-relaxed">{selectedForm.desc}</p>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex items-start justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="font-bold text-slate-500">Người lập & ký:</span>
                                <span className="font-semibold text-slate-800 text-right">{selectedForm.signer}</span>
                            </div>
                            <div className="flex items-start justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="font-bold text-slate-500">Cơ quan tiếp nhận:</span>
                                <span className="font-semibold text-slate-800 text-right">{selectedForm.target}</span>
                            </div>
                            <div className="flex items-start justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="font-bold text-slate-500">Thời hạn nộp:</span>
                                <span className="font-semibold text-amber-700 text-right">{selectedForm.deadline}</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                            <Button onClick={() => setSelectedForm(null)}>Đóng</Button>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownloadSample(selectedForm.code)}
                                className="bg-blue-700 font-bold"
                            >
                                Tải file mẫu {selectedForm.code} (.docx)
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </section>
    );
}

function AnnouncementCard({ item }) {
    const dateStr = new Date(item.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const excerpt = item.content
        ? item.content.length > 140 ? item.content.slice(0, 140) + '...' : item.content
        : 'Chưa có nội dung chi tiết.';

    return (
        <article className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between">
            {item.isPinned && (
                <div className="h-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-400" />
            )}

            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {item.isPinned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                            <span className="material-symbols-outlined text-[13px]">push_pin</span>
                            Ghim nổi bật
                        </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                        {item.category === 'NEWS' ? 'Tin tức' : 'Thông báo'}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto font-mono">{dateStr}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2 mb-2">
                    {item.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed flex-1 line-clamp-3">
                    {excerpt}
                </p>

                {item.fileUrl && (
                    <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-700 font-bold hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DownloadOutlined />
                        <span>{item.fileName || 'Tải file đính kèm'}</span>
                    </a>
                )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-400 flex items-center justify-between">
                <span>{item.author?.fullName || 'Quản trị viên Viện'}</span>
                <span className="text-blue-600 font-semibold group-hover:underline">Chi tiết →</span>
            </div>
        </article>
    );
}

function AnnouncementsSection({ announcements, loading, category, setCategory, pagination, onLoadMore }) {
    return (
        <section id="announcements-section" className="py-20 bg-white scroll-mt-20">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
                    <div>
                        <span className="text-xs font-black text-blue-700 tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            Bản tin học vụ
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
                            Thông Báo & Tin Tức Mới Nhất
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base mt-1">
                            Lịch bảo vệ, hạn nộp biểu mẫu và các thông báo khẩn từ Viện Công nghệ Số.
                        </p>
                    </div>

                    <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.key}
                                onClick={() => setCategory(cat.key)}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                    category === cat.key
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-slate-600 hover:text-blue-700'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-700 border-t-transparent" />
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-500 font-semibold">Chưa có thông báo nào trong danh mục này.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {announcements.map((item) => (
                                <AnnouncementCard key={item.id} item={item} />
                            ))}
                        </div>

                        {pagination && pagination.page < pagination.totalPages && (
                            <div className="mt-12 text-center">
                                <Button
                                    size="large"
                                    onClick={onLoadMore}
                                    className="font-bold border-blue-700 text-blue-700 hover:bg-blue-50 rounded-xl px-8"
                                >
                                    Xem thêm thông báo cũ hơn
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

function FooterSection() {
    return (
        <footer id="contact-section" className="bg-[#001c33] text-slate-300 border-t border-slate-800">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 py-16 lg:py-20">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <img
                                src="/tdmu-logo.png"
                                alt="TDMU Logo"
                                className="w-11 h-11 object-contain brightness-0 invert"
                            />
                            <div>
                                <p className="font-black text-white text-sm uppercase tracking-tight">Đại học Thủ Dầu Một</p>
                                <p className="text-xs text-blue-400 font-semibold">Viện Công nghệ Số</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Cổng thông tin quản trị và số hóa quy trình đồ án tốt nghiệp, phục vụ sinh viên, giảng viên và hội đồng học vụ.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-4 text-blue-400">
                            Quy Trình Học Vụ
                        </h4>
                        <ul className="space-y-2.5 text-xs text-slate-400">
                            <li><a href="#roadmap-section" className="hover:text-white transition-colors">Lộ trình 6 chặng đồ án</a></li>
                            <li><a href="#forms-section" className="hover:text-white transition-colors">Hướng dẫn biểu mẫu BM01-BM04</a></li>
                            <li><a href="#lecturers-section" className="hover:text-white transition-colors">Tra cứu Giảng viên hướng dẫn</a></li>
                            <li><a href="#announcements-section" className="hover:text-white transition-colors">Lịch xét duyệt & bảo vệ</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-4 text-blue-400">
                            Hỗ Trợ Sinh Viên
                        </h4>
                        <ul className="space-y-2.5 text-xs text-slate-400">
                            <li><span>Văn phòng Viện: Phòng B2-302</span></li>
                            <li><span>Hỗ trợ kỹ thuật: 0274 382 2518</span></li>
                            <li><span>Email: viencongngheso@tdmu.edu.vn</span></li>
                            <li><span>Giờ làm việc: 7h30 - 17h00 (T2 - T6)</span></li>
                        </ul>
                    </div>

                    {/* Address */}
                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-4 text-blue-400">
                            Địa Chỉ Đào Tạo
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Số 06 Trần Văn Ơn, Phường Phú Hòa, Thành phố Thủ Dầu Một, Tỉnh Bình Dương.
                        </p>
                        <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                            Hệ thống bảo đảm chất lượng đào tạo theo chuẩn quốc tế AUN-QA.
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
                    <p>© 2026 Viện Công nghệ Số — Trường Đại học Thủ Dầu Một. Bảo lưu mọi quyền.</p>
                    <p className="mt-2 sm:mt-0 font-mono">Phiên bản Hệ thống: v2.4.0-PROD</p>
                </div>
            </div>
        </footer>
    );
}

// ─── Main Component ─────────────────────────────────────────

function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('ALL');
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);

    // SEO
    useEffect(() => {
        document.title = 'Hệ thống Quản lý Đồ án & Khóa luận – Viện Công nghệ Số TDMU';
    }, []);

    // Fetch announcements
    const fetchAnnouncements = useCallback(async (pageNum = 1, cat = category, append = false) => {
        setLoading(!append);
        try {
            const params = { page: pageNum, limit: 6 };
            if (cat && cat !== 'ALL') params.category = cat;

            const res = await announcementService.getAnnouncements(params);
            if (res.success) {
                setAnnouncements((prev) => append ? [...prev, ...res.data] : res.data);
                setPagination(res.pagination);
            }
        } catch {
            // Public fail-safe
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        setPage(1);
        fetchAnnouncements(1, category, false);
    }, [category, fetchAnnouncements]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAnnouncements(nextPage, category, true);
    };

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-600 selection:text-white">
            <StickyHeader user={user} navigate={navigate} />
            <HeroSection navigate={navigate} user={user} />
            <RoadmapSection />
            <FacultyDirectorySection />
            <FormCenterSection />
            <AnnouncementsSection
                announcements={announcements}
                loading={loading}
                category={category}
                setCategory={setCategory}
                pagination={pagination}
                onLoadMore={handleLoadMore}
            />
            <FooterSection />
        </div>
    );
}

export default HomePage;
