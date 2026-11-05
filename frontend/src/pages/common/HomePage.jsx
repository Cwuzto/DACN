import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleHomePath } from '../../utils/authRedirect';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import userService from '../../services/userService';
import portalContentService from '../../services/portalContentService';
import { getPublicPortalView } from '../../utils/portalContent';
import { semesterService } from '../../services/semesterService';
import OpenModal from '../../components/common/OpenModal';
import AuthModal from '../../components/auth/AuthModal';

// 6 Guided Academic Stages (Exact OpenDesign Prototype)
const ROADMAP_STAGES = [
    {
        step: '01',
        title: 'Chuẩn bị & Đăng ký Đề tài',
        duration: 'TUẦN 01-02',
        tag: 'Đang diễn ra',
        tagType: 'badge-primary',
        desc: 'SV liên hệ GVHD, gửi nguyện vọng đề tài theo danh bạ. GVHD duyệt chấp thuận trên hệ thống.',
        deliverables: 'Đơn đăng ký đề tài trực tuyến (Hạn ngạch max 10 SV/GVHD)',
        rules: 'Mỗi đề tài tối đa 1 sinh viên (TopicRegistration). GVHD chịu trách nhiệm hướng dẫn xuyên suốt.',
    },
    {
        step: '02',
        title: 'Đề cương & Xét duyệt (BM01/02)',
        duration: 'TUẦN 03-04',
        tag: 'Sắp tới',
        tagType: 'badge-neutral',
        desc: 'Nộp đề cương BM01, Hội đồng thẩm định góp ý. Nộp đơn BM02 chính thức trình Hiệu trưởng ký QĐ.',
        deliverables: 'Đề cương chi tiết BM01, Đơn phê duyệt BM02, Quyết định giao đề tài',
        rules: 'Đề tài đạt thẩm định chuyển sang trạng thái IN_PROGRESS. Sinh viên được quyền xin điều chỉnh tên đề tài trong 7 ngày.',
    },
    {
        step: '03',
        title: 'Thực hiện & Theo dõi (BM03)',
        duration: 'TUẦN 05-11',
        tag: 'Tuần 05 - 11',
        tagType: 'badge-neutral',
        desc: 'Nghiên cứu, code thực nghiệm. Gặp GVHD định kỳ và vượt qua 2 buổi Checkpoint giữa kỳ.',
        deliverables: 'Nhật ký hướng dẫn BM03, Báo cáo Checkpoint 1 & 2',
        rules: 'Quá 21 ngày không có buổi gặp GVHD, hệ thống tự động phát cảnh báo nguy cơ trên Radar học vụ.',
    },
    {
        step: '04',
        title: 'Thẩm định Bảo vệ (BM04)',
        duration: 'TUẦN 12',
        tag: 'Cửa ải bắt buộc',
        tagType: 'badge-warning',
        desc: 'GVHD đánh giá toàn diện, lập phiếu nhận xét BM04 xác nhận ĐỒNG Ý cho sinh viên ra bảo vệ.',
        deliverables: 'Phiếu nhận xét đánh giá BM04 hoàn tất (COMPLETED)',
        rules: 'Chốt chặn bắt buộc: Chỉ sinh viên có BM04 ĐỒNG Ý mới được phân công vào Hội đồng bảo vệ chính thức.',
    },
    {
        step: '05',
        title: 'Hội đồng Chấm Bảo vệ',
        duration: 'TUẦN 13',
        tag: 'Bảo vệ chính thức',
        tagType: 'badge-neutral',
        desc: 'Hội đồng 3 thành viên (Chủ tịch, Thư ký, Phản biện) chấm điểm độc lập theo thang điểm chuẩn. Xuất biên bản BM05.',
        deliverables: 'Phiếu chấm điểm 3 thành viên, Khóa sổ điểm bảo vệ, Biên bản BM05',
        rules: 'Bảo vệ đạt yêu cầu (Điểm TB >= 5.0) chuyển trạng thái sang DEFENDED.',
    },
    {
        step: '06',
        title: 'Lưu chiểu & Cấp Chứng nhận',
        duration: 'TUẦN 14',
        tag: 'Hoàn thành',
        tagType: 'badge-success',
        desc: 'Nộp quyển PDF hoàn chỉnh, video demo và link GitHub codebase. Nhận Giấy chứng nhận hoàn thành có mã QR.',
        deliverables: 'Quyển khóa luận bản cứng & bản PDF, Mã QR Giấy chứng nhận hoàn thành',
        rules: 'Tất cả tài liệu được lưu trữ vĩnh viễn vào Thư viện số và cấp mã định danh học thuật.',
    },
];

// Standard Academic Templates (Exact OpenDesign Prototype)
const DOWNLOAD_TEMPLATES = [
    {
        code: 'Biểu mẫu BM01',
        title: 'Đề cương nghiên cứu chi tiết',
        meta: 'Phiên bản v2.4 · 142 KB',
        type: 'DOCX',
    },
    {
        code: 'Biểu mẫu BM02',
        title: 'Đơn đăng ký đề tài chính thức',
        meta: 'Phiên bản v2.0 · 98 KB',
        type: 'DOCX',
    },
    {
        code: 'Biểu mẫu BM03',
        title: 'Nhật ký & Tiến độ gặp GVHD',
        meta: 'Quy chuẩn Checkpoint · 185 KB',
        type: 'PDF',
    },
    {
        code: 'Biểu mẫu BM04',
        title: 'Phiếu nhận xét GVHD cho bảo vệ',
        meta: 'Cửa ải bảo vệ · 110 KB',
        type: 'PDF',
    },
];

// Complete OpenDesign Institutional Announcements Repository
const ANNOUNCEMENTS_DATA = {
    'tb-142': {
        id: 'tb-142',
        docNumber: '142/TB-VCS-ĐT',
        category: 'Khẩn cấp',
        categoryClass: 'badge-danger',
        badge: 'Khẩn cấp',
        badgeClass: 'badge-danger',
        issuedDate: '14/10/2026',
        date: '14/10/2026',
        issuedPlace: 'Hà Nội',
        effectiveDate: '14/10/2026 – 24/10/2026',
        signerName: 'TS. Lê Quang Dũng',
        signer: 'TS. Lê Quang Dũng',
        signerRole: 'KT. VIỆN TRƯỞNG',
        signerDelegate: 'PHÓ VIỆN TRƯỞNG PHỤ TRÁCH ĐÀO TẠO',
        scope: 'Sinh viên K21, Cán bộ GVHD, Thư ký các Bộ môn',
        title: 'THÔNG BÁO VỀ VIỆC GIA HẠN THỜI HẠN NỘP ĐƠN ĐỀ CƯƠNG NGHIÊN CỨU BM01 ĐỢT 1 NĂM HỌC 2026 - 2027',
        cardTitle: 'Thông báo gia hạn nộp đơn đề cương nghiên cứu BM01 đợt 1',
        subtitle: 'V/v điều chỉnh thời hạn hoàn thiện đề cương BM01 và kế hoạch thẩm định của các Bộ môn chuyên ngành',
        summary: 'Căn cứ đề xuất của các Bộ môn và tình hình thực tế triển khai đợt tốt nghiệp HK1 năm học 2026-2027, Ban Chủ nhiệm Viện Công nghệ Số quyết định gia hạn thời hạn nộp đề cương chi tiết (BM01) đến hết 17h00 ngày 24/10/2026, đồng thời điều chỉnh lịch thẩm định của các Hội đồng chuyên môn.',
        preamble: 'Căn cứ Quyết định số 1024/QĐ-ĐHCN ngày 15/08/2024 của Hiệu trưởng Trường Đại học Công nghệ về việc ban hành Quy chế Đào tạo trình độ Đại học chính quy;\nCăn cứ Kế hoạch năm học 2026 - 2027 của Viện Công nghệ Số đối với khóa đào tạo K21;\nXét đề nghị của Trưởng các Bộ môn Kỹ thuật Phần mềm, Khoa học Dữ liệu & AI, Mạng Máy tính & ATTT, Hệ thống Thông tin Quản lý và Trợ lý Giáo vụ Viện,',
        articles: [
            {
                title: 'Mục 1. Gia hạn thời hạn nộp Đề cương nghiên cứu chi tiết (BM01)',
                content: 'Gia hạn thời gian nộp Biểu mẫu BM01 cho toàn thể 128 sinh viên đủ điều kiện làm đồ án tốt nghiệp đợt 1 năm học 2026 - 2027 thêm 10 ngày làm việc.\nThời hạn cuối cùng (Deadline cứng): Đúng 17h00 ngày 24 tháng 10 năm 2026. Sau thời điểm này, cổng nộp bài trực tuyến trên hệ thống DACN sẽ tự động đóng và không tiếp nhận bất kỳ trường hợp nộp muộn nào trừ khi có văn bản xác nhận lý do bất khả kháng của Ban Giám hiệu.',
            },
            {
                title: 'Mục 2. Quy chuẩn phương thức nộp biểu mẫu Hybrid (DACN Portal + File Scan)',
                content: 'Sinh viên thực hiện nộp đề cương theo quy trình chuẩn 2 bước bắt buộc:\n• Bước 1 (Trực tuyến): Đăng nhập Cổng DACN, điền tóm tắt mục tiêu nghiên cứu, phương pháp thực nghiệm, kiến trúc dự kiến và liên kết kho mã nguồn (GitHub/GitLab).\n• Bước 2 (Văn bản scan): Xuất file BM01 từ hệ thống, xin ý kiến nhận xét và chữ ký chấp thuận của Giảng viên hướng dẫn (GVHD), sau đó tải bản scan PDF có đầy đủ chữ ký lên hệ thống để phục vụ công tác lưu trữ học vụ.',
            },
            {
                title: 'Mục 3. Bảng điều chỉnh tiến độ các mốc học vụ tiếp theo',
                isTimelineTable: true,
                tableRows: [
                    { milestone: 'Hạn chót nộp BM01 gia hạn', oldDate: '14/10/2026', newDate: '24/10/2026 (17h00)', note: 'Đã gia hạn +10 ngày' },
                    { milestone: 'GVHD duyệt và ký xác nhận', oldDate: '16/10/2026', newDate: '26/10/2026', note: 'Thực hiện trên Cổng DACN' },
                    { milestone: 'Hội đồng Bộ môn thẩm định BM01/02', oldDate: '20/10 - 22/10/2026', newDate: '28/10 - 30/10/2026', note: '2 Giảng viên thẩm định độc lập' },
                    { milestone: 'Công bố kết quả thẩm định đề cương', oldDate: '24/10/2026', newDate: '02/11/2026', note: 'Đạt / Yêu cầu chỉnh sửa' },
                ],
            },
            {
                title: 'Mục 4. Chế tài đối với trường hợp không hoàn thành đề cương',
                content: 'Sinh viên không nộp đề cương BM01 hoặc đề cương bị Hội đồng thẩm định đánh giá KHÔNG ĐẠT sau 02 lần chỉnh sửa sẽ bị hủy quyền làm đồ án tốt nghiệp trong học kỳ này và phải làm đơn đăng ký lại vào đợt kế tiếp theo Quy chế Đào tạo.',
            },
        ],
        recipients: [
            'Ban Giám hiệu (để báo cáo);',
            'Phòng Đào tạo (để phối hợp);',
            'Các Bộ môn trực thuộc Viện (để thi hành);',
            'Cán bộ Giảng viên hướng dẫn;',
            'Toàn thể Sinh viên K21 đủ điều kiện;',
            'Lưu: Văn thư, Giáo vụ ĐT.',
        ],
        filesCount: 3,
        fileLabel: '3 tệp (PDF, XLSX, DOCX)',
        attachments: [
            {
                id: 'att-1',
                name: '142_TB-VCS-ĐT_Gia-han-BM01.pdf',
                title: 'Văn bản Thông báo chính thức có chữ ký số & dấu đỏ Viện',
                type: 'pdf',
                size: '245 KB',
                version: 'Bản ký duyệt số hóa',
                hash: 'SHA256: 4e8b...91f2',
                canPreview: true,
            },
            {
                id: 'att-2',
                name: 'Phu-luc-01_Lich-trinh-dieu-chinh-Dot1.xlsx',
                title: 'Phụ lục phân công lịch thẩm định chi tiết 4 Bộ môn (KTPM, CNTT, MMT, HTTT)',
                type: 'xlsx',
                size: '182 KB',
                version: 'v1.2 Cập nhật',
                hash: 'SHA256: a12c...3d8e',
                canPreview: false,
            },
            {
                id: 'att-3',
                name: 'Mau-BM01_De-cuong-nghien-cuu_v2.4.docx',
                title: 'Biểu mẫu BM01 Đề cương chuẩn hóa bổ sung điều khoản cam kết Liêm chính học thuật',
                type: 'docx',
                size: '142 KB',
                version: 'Mẫu biểu v2.4',
                hash: 'SHA256: 7f3a...c450',
                canPreview: false,
            },
        ],
    },
    'qd-286': {
        id: 'qd-286',
        docNumber: '286/QĐ-ĐHCN-ĐT',
        category: 'Quyết định',
        categoryClass: 'badge-primary',
        badge: 'Quyết định',
        badgeClass: 'badge-primary',
        issuedDate: '10/10/2026',
        date: '10/10/2026',
        issuedPlace: 'Hà Nội',
        effectiveDate: 'Từ ngày ký ban hành',
        signerName: 'GS. TS. Nguyễn Văn Hưng',
        signer: 'GS. TS. Nguyễn Văn Hưng',
        signerRole: 'HIỆU TRƯỞNG',
        signerDelegate: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ',
        scope: 'Phòng Đào tạo, Viện Công nghệ Số, 128 sinh viên có tên',
        title: 'QUYẾT ĐỊNH CÔNG NHẬN DANH SÁCH 128 SINH VIÊN ĐỦ ĐIỀU KIỆN THỰC HIỆN ĐỒ ÁN TỐT NGHIỆP',
        cardTitle: 'Danh sách chính thức 128 sinh viên đủ điều kiện làm đồ án tốt nghiệp',
        subtitle: 'Khóa 21 (Niên khóa 2023 - 2027) ngành Công nghệ Thông tin, Kỹ thuật Phần mềm, Mạng máy tính',
        summary: 'Hiệu trưởng Trường Đại học Công nghệ ký quyết định phê duyệt danh sách chính thức 128 sinh viên khóa K21 tích lũy đủ số tín chỉ quy định, không bị kỷ luật học vụ và đủ điều kiện làm khóa luận tốt nghiệp trong Học kỳ 1 năm học 2026 - 2027.',
        preamble: 'Căn cứ Điều lệ Trường Đại học ban hành kèm theo Quyết định số 70/2014/QĐ-TTg của Thủ tướng Chính phủ;\nCăn cứ Quy chế Đào tạo đại học chính quy hiện hành;\nXét đề nghị của Trưởng phòng Đào tạo và Viện trưởng Viện Công nghệ Số,',
        articles: [
            {
                title: 'Điều 1. Công nhận danh sách sinh viên đủ điều kiện',
                content: 'Công nhận 128 sinh viên thuộc các chuyên ngành Kỹ thuật Phần mềm (48 SV), Khoa học Dữ liệu & AI (36 SV), Mạng máy tính & An toàn thông tin (26 SV), Hệ thống thông tin (18 SV) đủ điều kiện làm Đồ án / Khóa luận tốt nghiệp (có danh sách chi tiết kèm theo).',
            },
            {
                title: 'Điều 2. Quy định về phân công Giảng viên hướng dẫn',
                content: 'Giao Viện Công nghệ Số điều phối công tác lựa chọn đề tài và phân công Giảng viên hướng dẫn đúng quy chuẩn: Mỗi sinh viên làm 01 đề tài độc lập; Mỗi Giảng viên hướng dẫn không quá 10 sinh viên trong cùng một đợt.',
            },
            {
                title: 'Điều 3. Trách nhiệm thi hành',
                content: 'Trưởng phòng Đào tạo, Viện trưởng Viện Công nghệ Số, Thủ trưởng các đơn vị có liên quan và các sinh viên có tên trong danh sách chịu trách nhiệm thi hành Quyết định này.',
            },
        ],
        recipients: [
            'Ban Giám hiệu (báo cáo);',
            'Phòng Đào tạo, Phòng CTSV;',
            'Viện Công nghệ Số;',
            'Các sinh viên có tên tại Điều 1;',
            'Lưu: VT, ĐT.',
        ],
        filesCount: 2,
        fileLabel: '2 tệp (PDF, XLSX)',
        attachments: [
            {
                id: 'att-286-1',
                name: '286_QD-DHCN-DT_Cong-nhan-DS-SV.pdf',
                title: 'Quyết định công nhận danh sách 128 SV đủ điều kiện làm đồ án (Bản có dấu mộc đỏ)',
                type: 'pdf',
                size: '310 KB',
                version: 'Quyết định gốc',
                hash: 'SHA256: b29f...671a',
                canPreview: true,
            },
            {
                id: 'att-286-2',
                name: 'Danh-sach-128-SV-Du-Dieu-Kien-K21.xlsx',
                title: 'Bảng tổng hợp điểm tích lũy, số tín chỉ và xếp lớp học phần của 128 sinh viên',
                type: 'xlsx',
                size: '220 KB',
                version: 'Sổ bộ ĐT',
                hash: 'SHA256: 88de...f402',
                canPreview: false,
            },
        ],
    },
    'hd-89': {
        id: 'hd-89',
        docNumber: '89/HD-VCS',
        category: 'Hướng dẫn',
        categoryClass: 'badge-brand',
        badge: 'Hướng dẫn',
        badgeClass: 'badge-brand',
        issuedDate: '05/10/2026',
        date: '05/10/2026',
        issuedPlace: 'Hà Nội',
        effectiveDate: 'Áp dụng cho niên khóa 2026 - 2027',
        signerName: 'PGS. TS. Phan Thanh Tùng',
        signer: 'PGS. TS. Phan Thanh Tùng',
        signerRole: 'CHỦ TỊCH HỘI ĐỒNG',
        signerDelegate: 'HỘI ĐỒNG KHOA HỌC & ĐÀO TẠO VIỆN',
        scope: 'Cán bộ GVHD, Giảng viên phản biện, Toàn thể sinh viên',
        title: 'HƯỚNG DẪN QUY TRÌNH KIỂM TRA ĐẠO VĂN (TURNITIN) VÀ LIÊM CHÍNH HỌC THUẬT',
        cardTitle: 'Quy định kiểm tra đạo văn (Turnitin) và Liêm chính học thuật 2026',
        subtitle: 'Quy chuẩn chỉ số tương đồng và các biện pháp bảo đảm tính nguyên bản của công trình tốt nghiệp',
        summary: 'Hướng dẫn cụ thể về chỉ số tương đồng cho phép (Similarity Index ≤ 20%), quy trình quét trùng lặp mã nguồn và thuyết minh báo cáo trên hệ thống bản quyền Turnitin của Nhà trường trước khi bước vào vòng bảo vệ Hội đồng.',
        preamble: 'Nhằm nâng cao chất lượng nghiên cứu khoa học, xây dựng văn hóa liêm chính học thuật và bảo vệ quyền sở hữu trí tuệ của người học, Viện Công nghệ Số ban hành hướng dẫn kiểm tra đạo văn đối với toàn bộ các sản phẩm tốt nghiệp năm học 2026 - 2027,',
        articles: [
            {
                title: 'Khoản 1. Chỉ số tương đồng cho phép (Similarity Threshold)',
                content: '• Chỉ số tương đồng tổng thể (Overall Similarity Index) của toàn văn báo cáo không được vượt quá 20%.\n• Mức độ tương đồng với một nguồn đơn lẻ (Single Source Match) không được vượt quá 5%.\n• Hệ thống được cấu hình tự động loại trừ (Exclude): Trang bìa, Lời cảm ơn, Danh mục tài liệu tham khảo và các đoạn trích dẫn trực tiếp trong ngoặc kép theo chuẩn IEEE/APA.',
            },
            {
                title: 'Khoản 2. Quy trình nộp báo cáo quét Turnitin',
                content: 'Trước ngày bảo vệ tối thiểu 07 ngày, sinh viên phải nộp file PDF toàn văn qua lớp học Turnitin do Cổng DACN cung cấp. Hệ thống sẽ trả về Phiếu Kết Quả Phân Tích Tính Nguyên Bản có mã QR xác thực để kẹp vào hồ sơ bảo vệ BM04.',
            },
            {
                title: 'Khoản 3. Xử lý vi phạm liêm chính học thuật',
                content: 'Trường hợp phát hiện hành vi gian lận (sử dụng công cụ can thiệp ký tự trắng, mua bán đồ án hoặc sao chép mã nguồn nguyên bản không trích dẫn), sinh viên sẽ bị xử lý kỷ luật từ mức Đình chỉ bảo vệ đến Cảnh cáo học vụ theo Quy chế Đào tạo.',
            },
        ],
        recipients: [
            'Hội đồng Khoa học & Đào tạo Viện;',
            'Các Bộ môn và Giảng viên;',
            'Sinh viên làm đồ án tốt nghiệp;',
            'Lưu: VT, KHCN.',
        ],
        filesCount: 2,
        fileLabel: '2 tệp (PDF scan, PDF HD)',
        attachments: [
            {
                id: 'att-89-1',
                name: '89_HD-VCS_Quy-trinh-Turnitin-2026.pdf',
                title: 'Hướng dẫn quy trình kiểm tra đạo văn và liêm chính học thuật 2026 (Bản PDF chính thức)',
                type: 'pdf',
                size: '195 KB',
                version: 'v1.0 Ban hành',
                hash: 'SHA256: 3c44...719b',
                canPreview: true,
            },
            {
                id: 'att-89-2',
                name: 'Huong-dan-cai-dat-tai-khoan-Turnitin-VCS.pdf',
                title: 'Tài liệu hướng dẫn sinh viên kích hoạt tài khoản Turnitin trường cấp',
                type: 'pdf',
                size: '450 KB',
                version: 'Tài liệu hướng dẫn',
                hash: 'SHA256: dd21...a78e',
                canPreview: true,
            },
        ],
    },
};

export default function HomePage() {
    const navigate = useNavigate();
    const { user, setAuth } = useAuthStore();

    // Data State
    const [lecturers, setLecturers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [portalContent, setPortalContent] = useState({ configuration: null, links: [], templates: [] });
    const publicPortalView = useMemo(() => getPublicPortalView(portalContent), [portalContent]);
    const { configuration: portalConfiguration, linksByGroup } = publicPortalView;
    const [currentSemester, setCurrentSemester] = useState(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [previewModalFile, setPreviewModalFile] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    // Faculty filter state
    const [facultySearch, setFacultySearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [quotaFilter, setQuotaFilter] = useState('ALL');

    // Scroll & View states for modern OpenDesign interactions
    const [isScrolled, setIsScrolled] = useState(false);
    const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
    const [activeNavSection, setActiveNavSection] = useState('');
    const [facultyExpanded, setFacultyExpanded] = useState(false);

    // Filtered Lecturers
    const filteredLecturers = useMemo(() => {
        return lecturers.filter((lec) => {
            if (facultySearch.trim()) {
                const q = facultySearch.toLowerCase();
                const matchName = lec.fullName?.toLowerCase().includes(q);
                const matchDept = lec.department?.toLowerCase().includes(q);
                const matchTopic = lec.mentoredTopics?.some((t) => t.title?.toLowerCase().includes(q));
                if (!matchName && !matchDept && !matchTopic) return false;
            }

            if (deptFilter !== 'ALL') {
                if (!lec.department?.toLowerCase().includes(deptFilter.toLowerCase())) {
                    return false;
                }
            }

            const count = Math.min(10, lec._count?.mentoredTopics || (lec.mentoredTopics?.length ?? 4));
            const max = 10;
            if (quotaFilter === 'AVAILABLE' && count >= max) return false;
            if (quotaFilter === 'FULL' && count < max) return false;

            return true;
        });
    }, [lecturers, facultySearch, deptFilter, quotaFilter]);

    const sortedTemplates = useMemo(() => {
        const list = Array.isArray(portalContent.templates) ? [...portalContent.templates] : [];
        return list.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.code || '').localeCompare(String(b.code || '')));
    }, [portalContent.templates]);

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    useEffect(() => {
        let framePending = false;
        const handleScroll = () => {
            if (framePending) return;
            framePending = true;
            window.requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                setIsScrolled(scrollY > 16);
                setIsScrolledPastHero(scrollY > 480);

                const sections = ['roadmap', 'faculty', 'downloads', 'announcements'];
                let current = '';
                for (const id of sections) {
                    const el = document.getElementById(id);
                    if (el) {
                        const top = el.offsetTop - 13;
                        if (scrollY >= top) {
                            current = id;
                        }
                    }
                }
                setActiveNavSection(current);
                framePending = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ─── OPENDESIGN MOTION ENGINE (SMOOTH SCROLL REVEAL, EASING COUNTERS & PROGRESS) ─
    useEffect(() => {
        if (selectedAnnouncement) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.documentElement.classList.add('motion-ready');

        // 1. Staggered scroll-reveal targets
        const sectionHeaders = document.querySelectorAll(
            '#roadmap > .container > div:first-child, #faculty > .container > div:first-child, #downloads > .container > div:first-child, #announcements > .container > div:first-child'
        );
        const targets = [...sectionHeaders];

        document.querySelectorAll('.roadmap-grid, .faculty-grid, .download-grid').forEach((group) => {
            Array.from(group.children).forEach((card, index) => {
                card.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 45}ms`);
                targets.push(card);
            });
        });

        document.querySelectorAll('#announcements .announcement-card').forEach((card, index) => {
            card.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 50}ms`);
            targets.push(card);
        });

        targets.forEach((target) => {
            if (!target.classList.contains('reveal-on-scroll')) {
                target.classList.add('reveal-on-scroll');
            }
        });

        let revealObserver = null;
        if (!reduceMotion && 'IntersectionObserver' in window) {
            revealObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            revealObserver.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
            );
            targets.forEach((target) => revealObserver.observe(target));
        } else {
            targets.forEach((target) => target.classList.add('is-visible'));
        }

        // 2. Animated Period Counters with Cubic Easing
        let counterObserver = null;
        const statGrid = document.querySelector('.period-stat-grid');
        const counters = document.querySelectorAll('.period-stat-val[data-count]');

        if (statGrid && counters.length && !reduceMotion) {
            const runCounters = () => {
                counters.forEach((counter, index) => {
                    const target = Number(counter.dataset.count) || 0;
                    const duration = 520;
                    const delay = index * 60;

                    setTimeout(() => {
                        const startTime = performance.now();
                        counter.textContent = '0';

                        const tick = (now) => {
                            const progress = Math.min((now - startTime) / duration, 1);
                            const eased = 1 - Math.pow(1 - progress, 3);
                            counter.textContent = String(Math.round(target * eased));
                            if (progress < 1) requestAnimationFrame(tick);
                        };

                        requestAnimationFrame(tick);
                    }, delay);
                });
            };

            if ('IntersectionObserver' in window) {
                counterObserver = new IntersectionObserver(
                    (entries) => {
                        if (entries.some((entry) => entry.isIntersecting)) {
                            runCounters();
                            counterObserver.disconnect();
                        }
                    },
                    { threshold: 0.35 }
                );
                counterObserver.observe(statGrid);
            } else {
                runCounters();
            }
        }

        // 3. Smooth Semester Progress Bar Animation
        let progressObserver = null;
        const progressBar = document.querySelector('.semester-progress-bar');
        if (progressBar && !reduceMotion) {
            if ('IntersectionObserver' in window) {
                progressObserver = new IntersectionObserver(
                    (entries) => {
                        if (entries.some((entry) => entry.isIntersecting)) {
                            progressBar.classList.add('is-visible');
                            progressObserver.disconnect();
                        }
                    },
                    { threshold: 0.4 }
                );
                progressObserver.observe(progressBar);
            } else {
                progressBar.classList.add('is-visible');
            }
        }

        return () => {
            if (revealObserver) revealObserver.disconnect();
            if (counterObserver) counterObserver.disconnect();
            if (progressObserver) progressObserver.disconnect();
        };
    }, [selectedAnnouncement, filteredLecturers, facultyExpanded, announcements]);

    // Toast Timer Helper
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage((current) => (current === msg ? null : current));
        }, 3500);
    };

    // Load initial public data
    useEffect(() => {
        let isMounted = true;

        // 1. Current Active Semester (Public)
        semesterService.getPublic()
            .then((res) => {
                if (isMounted && res?.success && Array.isArray(res.data)) {
                    const active = res.data.find((s) => s.isActive || s.status === 'ACTIVE');
                    const chosen = active || getClosestSemester(res.data) || res.data[0];
                    setCurrentSemester(chosen);
                }
            })
            .catch(() => {});

        // 2. Public Lecturers with research areas and quota
        userService.getPublicLecturers()
            .then((res) => {
                if (isMounted && res?.success && Array.isArray(res.data)) {
                    setLecturers(res.data);
                }
            })
            .catch(() => {});

        // 3. Published Portal CMS content only. There is intentionally no local sample-data fallback.
        portalContentService.getPublicContent()
            .then((res) => {
                if (isMounted && res?.success) {
                    const content = res.data || {};
                    setPortalContent({ configuration: content.configuration || null, links: content.links || [], templates: content.templates || [] });
                    setAnnouncements(content.announcements || []);
                }
            })
            .catch(() => {
                if (isMounted) setAnnouncements([]);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Sync URL Hash Routing for Announcements (#announcement-[id])
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash && hash.startsWith('#announcement-')) {
                const docId = hash.replace('#announcement-', '');
                const targetDoc = announcements.find((a) => String(a.id) === docId);
                if (targetDoc) {
                    setSelectedAnnouncement(targetDoc);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else if (hash === '' || hash === '#') {
                setSelectedAnnouncement(null);
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [announcements]);

    // Handle ?login=true from URL redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('login') === 'true') {
            setIsLoginModalOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Handle Quick Navigation if logged in
    const handleWorkspaceEntry = () => {
        if (!user) {
            setIsLoginModalOpen(true);
            return;
        }
        navigate(getRoleHomePath(user));
    };

    // Open login with optional target
    const openLoginWithTarget = (lecturerName = null) => {
        if (user) {
            if (user.role === 'STUDENT') {
                navigate('/student/topics');
            } else {
                handleWorkspaceEntry();
            }
            return;
        }
        setIsLoginModalOpen(true);
    };

    // Helper for formatting lecturer academic title
    const formatAcademicName = (lec) => {
        const titleMap = {
            'GIAO_SU': 'GS. TS.',
            'PHO_GIAO_SU': 'PGS. TS.',
            'TIEN_SI': 'TS.',
            'THAC_SI': 'ThS.',
        };
        const prefix = titleMap[lec.academicTitle] || (lec.academicTitle ? `${lec.academicTitle} ` : 'ThS. ');
        return `${prefix} ${lec.fullName}`;
    };

    // Helper for lecturer avatar initials
    const getInitials = (fullName) => {
        if (!fullName) return 'GV';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return fullName.slice(0, 2).toUpperCase();
    };

    // Document Detail Actions
    const handleOpenAnnouncementDetail = (ann) => {
        setSelectedAnnouncement(ann);
        window.location.hash = 'announcement-' + ann.id;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToSection = (targetSelector) => {
        const target = targetSelector.startsWith('#')
            ? document.querySelector(targetSelector)
            : document.getElementById(targetSelector);
        if (target) {
            const topnav = document.querySelector('.topnav');
            const headerOffset = topnav ? topnav.offsetHeight : 68;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerOffset;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
    };

    const handleBackToPortal = (hash = '') => {
        setSelectedAnnouncement(null);
        if (hash) {
            window.history.replaceState(null, '', hash);
            scrollToSection(hash);
        } else {
            window.history.replaceState(null, '', window.location.pathname);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCopyDocShareLink = () => {
        const url = window.location.origin + window.location.pathname + '#announcement-' + (selectedAnnouncement?.id || 'tb-142');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url)
                .then(() => showToast('Đã sao chép liên kết văn bản vào bộ nhớ tạm!'))
                .catch(() => showToast(`Liên kết: ${url}`));
        } else {
            showToast(`Liên kết: ${url}`);
        }
    };

    const handleDownloadAttachment = (filename) => {
        showToast(`Đang tải tệp: ${filename} (Đã xác thực chữ ký số SHA-256)`);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}>
            {/* ─── TOP NAVIGATION BAR ────────────────────────────────────── */}
            <header className={`topnav ${isScrolled ? 'is-scrolled' : ''}`} data-od-id="public-topnav">
                <div className="container topnav-inner">
                    <div className="brand-group" onClick={() => handleBackToPortal()} style={{ cursor: 'pointer' }}>
                        <img
                            className="brand-logo"
                            src="https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/dacn/branding/tdmu-logo.svg"
                            onError={(e) => { e.currentTarget.src = '/assets/tdmu-logo.svg'; }}
                            alt="Đại học Thủ Dầu Một"
                            width="107"
                            height="40"
                        />
                        <div className="brand-text">
                            <h1>{portalConfiguration.institutionName}</h1>
                            <p>{portalConfiguration.siteTitle}</p>
                        </div>
                    </div>

                    <nav>
                        <ul className="nav-links">
                            <li><a href="#roadmap" className={`nav-link ${activeNavSection === 'roadmap' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleBackToPortal('#roadmap'); }}>Lộ trình 6 Chặng</a></li>
                            <li><a href="#faculty" className={`nav-link ${activeNavSection === 'faculty' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleBackToPortal('#faculty'); }}>Danh bạ GVHD & Hướng NC</a></li>
                            <li><a href="#downloads" className={`nav-link ${activeNavSection === 'downloads' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleBackToPortal('#downloads'); }}>Biểu mẫu BM01-BM05</a></li>
                            <li><a href="#announcements" className={`nav-link ${activeNavSection === 'announcements' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleBackToPortal('#announcements'); }}>Bản tin &amp; Quyết định</a></li>
                        </ul>
                    </nav>

                    <div className="nav-actions">
                        {user ? (
                            <button className="btn btn-brand topnav-login" onClick={handleWorkspaceEntry} type="button">
                                <div style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    background: '#FFFFFF',
                                    color: '#0F766E',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 10
                                }}>
                                    {user.fullName?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <span>Vào Bàn làm việc ({user.role === 'ADMIN' ? 'Admin' : user.role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên'})</span>
                            </button>
                        ) : (
                            <button className="btn btn-brand topnav-login" onClick={() => setIsLoginModalOpen(true)} type="button" data-od-id="btn-login-trigger" aria-label="Đăng nhập Cổng Học vụ">
                                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                    <polyline points="10 17 15 12 10 7" />
                                    <line x1="15" y1="12" x2="3" y2="12" />
                                </svg>
                                <span>Đăng nhập</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ─── CONDITIONAL: ANNOUNCEMENT DETAIL VIEW OR MAIN PORTAL ─── */}
            {selectedAnnouncement ? (
                /* Document Real Content View Frame */
                <main id="announcementDetailView" className="doc-view-container" style={{ display: 'block' }} data-od-id="announcement-detail-view">
                    <div className="container">
                        {/* Top Action & Navigation */}
                        <div className="doc-top-nav-bar">
                            <div className="doc-breadcrumbs">
                                <a href="javascript:void(0)" onClick={() => handleBackToPortal()}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                        <polyline points="9 22 9 12 15 12 15 22"/>
                                    </svg>
                                    Trang chủ Cổng thông tin
                                </a>
                                <span className="separator">/</span>
                                <a href="javascript:void(0)" onClick={() => handleBackToPortal('#announcements')}>Bản tin &amp; Quyết định</a>
                                <span className="separator">/</span>
                                <span className="current" style={{ maxWidth: 360, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                    {selectedAnnouncement.title}
                                </span>
                            </div>

                            <div className="doc-actions-group">
                                <button className="btn btn-secondary" onClick={() => handleBackToPortal()}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="19" y1="12" x2="5" y2="12"/>
                                        <polyline points="12 19 5 12 12 5"/>
                                    </svg>
                                    Quay lại Cổng học vụ
                                </button>
                                <button className="btn btn-secondary" onClick={() => window.print()}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 6 2 18 2 18 9"/>
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                        <rect x="6" y="14" width="12" height="8"/>
                                    </svg>
                                    In thông báo
                                </button>
                                <button className="btn btn-secondary" onClick={handleCopyDocShareLink}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                    </svg>
                                    Sao chép liên kết
                                </button>
                                {selectedAnnouncement.fileUrl && (
                                    <a
                                        className="btn btn-primary"
                                        href={selectedAnnouncement.fileUrl}
                                        download={selectedAnnouncement.fileName || true}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={() => showToast(`Đang tải tệp: ${selectedAnnouncement.fileName || 'tai-lieu.pdf'}`)}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        Tải tệp đính kèm
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Document Layout Grid: Left (Real Content Article) + Right (Sidebar) */}
                        <div className="doc-layout-grid">
                            {/* Left: Real Announcement Content */}
                            <article className="doc-paper" id="docPaperContainer">
                                {/* Header thông tin thực tế */}
                                <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: 20, marginBottom: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                                        <span className="badge badge-brand" style={{ fontSize: 12, padding: '4px 10px' }}>
                                            {selectedAnnouncement.category === 'NEWS' ? 'Tin tức & Sự kiện' : 'Thông báo & Quyết định học vụ'}
                                        </span>
                                        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                            Mã văn bản: <strong>#{selectedAnnouncement.id}</strong>
                                        </span>
                                    </div>

                                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)', lineHeight: 1.35, margin: '0 0 16px' }}>
                                        {selectedAnnouncement.title}
                                    </h1>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'var(--muted)', background: 'var(--bg)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                        <div>
                                            <span style={{ color: 'var(--muted)' }}>Ngày đăng: </span>
                                            <strong style={{ color: 'var(--fg)' }}>
                                                {selectedAnnouncement.createdAt ? new Date(selectedAnnouncement.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Học kỳ hiện hành'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--muted)' }}>Cơ quan phát hành: </span>
                                            <strong style={{ color: 'var(--brand)' }}>
                                                {portalConfiguration.institutionName || 'Viện Công nghệ Số'}
                                            </strong>
                                        </div>
                                        {selectedAnnouncement.authorName && (
                                            <div>
                                                <span style={{ color: 'var(--muted)' }}>Người đăng: </span>
                                                <strong style={{ color: 'var(--fg)' }}>{selectedAnnouncement.authorName}</strong>
                                            </div>
                                        )}
                                        <div>
                                            <span style={{ color: 'var(--muted)' }}>Trạng thái: </span>
                                            <span className="badge badge-success" style={{ fontSize: 11, padding: '2px 8px' }}>Đã công khai</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Nội dung thực tế bản tin */}
                                <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--fg)', textAlign: 'justify', marginBottom: 28 }}>
                                    {selectedAnnouncement.content ? (
                                        <div style={{ whiteSpace: 'pre-line' }}>{selectedAnnouncement.content}</div>
                                    ) : selectedAnnouncement.richContentHtml ? (
                                        <div dangerouslySetInnerHTML={{ __html: selectedAnnouncement.richContentHtml }} />
                                    ) : (
                                        <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                            Toàn văn nội dung quyết định học vụ được đính kèm trong tệp tài liệu chính thức bên dưới.
                                        </p>
                                    )}
                                </div>

                                {/* Khung tệp đính kèm & Nhúng xem trước PDF trực tiếp */}
                                {selectedAnnouncement.fileUrl && (
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                        <polyline points="14 2 14 8 20 8"/>
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--fg)' }}>
                                                        {selectedAnnouncement.fileName || 'Tài liệu đính kèm'}
                                                    </h3>
                                                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                                                        Tệp văn bản chính thức ban hành kèm theo thông báo
                                                    </p>
                                                </div>
                                            </div>
                                            <a
                                                className="btn btn-primary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 16px' }}
                                                href={selectedAnnouncement.fileUrl}
                                                download={selectedAnnouncement.fileName || true}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={() => showToast(`Đang tải tệp: ${selectedAnnouncement.fileName || 'tai-lieu.pdf'}`)}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                    <polyline points="7 10 12 15 17 10"/>
                                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                                </svg>
                                                Tải file về máy ({selectedAnnouncement.fileName?.split('.').pop()?.toUpperCase() || 'PDF'})
                                            </a>
                                        </div>

                                        {/* Trình xem PDF nhúng trực tiếp nếu tệp là PDF */}
                                        {(selectedAnnouncement.fileUrl.toLowerCase().includes('.pdf') || selectedAnnouncement.fileName?.toLowerCase().endsWith('.pdf')) && (
                                            <div style={{ marginTop: 14, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                                                <div style={{ background: '#F8FAFC', padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Xem trước trực tiếp tài liệu</span>
                                                    <a href={selectedAnnouncement.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                                                        Mở toàn màn hình &rarr;
                                                    </a>
                                                </div>
                                                <iframe
                                                    src={`${selectedAnnouncement.fileUrl}#toolbar=1`}
                                                    title={selectedAnnouncement.title}
                                                    width="100%"
                                                    height="750px"
                                                    style={{ border: 'none', display: 'block', background: '#FFFFFF' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>

                            {/* Right: Sidebar */}
                            <aside>
                                {/* Widget Tóm tắt */}
                                <div className="doc-sidebar-widget">
                                    <div className="doc-sidebar-title">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="12" y1="16" x2="12" y2="12"/>
                                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                                        </svg>
                                        Thông Tin Bản Tin
                                    </div>
                                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fg)', fontWeight: 600 }}>
                                        {selectedAnnouncement.title}
                                    </div>
                                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                                        <div>Cơ quan ban hành: <strong style={{ color: 'var(--fg)' }}>{portalConfiguration.institutionName || 'Viện Công nghệ Số'}</strong></div>
                                        {selectedAnnouncement.authorName && (
                                            <div>Người đăng: <strong style={{ color: 'var(--fg)' }}>{selectedAnnouncement.authorName}</strong></div>
                                        )}
                                        {selectedAnnouncement.fileName && (
                                            <div style={{ wordBreak: 'break-all' }}>Tệp đính kèm: <strong style={{ color: 'var(--accent)' }}>{selectedAnnouncement.fileName}</strong></div>
                                        )}
                                        <div>Tính xác thực: <span className="badge badge-success" style={{ fontSize: 11, padding: '2px 8px' }}>Chính thức từ Cổng Portal</span></div>
                                    </div>
                                </div>

                                {/* Widget Các bản tin khác */}
                                {announcements.filter((doc) => doc.id !== selectedAnnouncement.id).length > 0 && (
                                    <div className="doc-sidebar-widget">
                                        <div className="doc-sidebar-title">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                <polyline points="14 2 14 8 20 8"/>
                                            </svg>
                                            Bản Tin &amp; Quyết Định Khác
                                        </div>
                                        <div>
                                            {announcements
                                                .filter((doc) => doc.id !== selectedAnnouncement.id)
                                                .slice(0, 5)
                                                .map((item) => (
                                                    <div key={item.id} className="related-doc-item" onClick={() => handleOpenAnnouncementDetail(item)}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                            <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 6px' }}>
                                                                {item.category === 'NEWS' ? 'Tin tức' : 'Thông báo'}
                                                            </span>
                                                            <span className="related-doc-date">
                                                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : ''}
                                                            </span>
                                                        </div>
                                                        <div className="related-doc-title">{item.title}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Widget Trợ giúp */}
                                <div className="doc-sidebar-widget" style={{ background: 'linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 100%)', borderColor: '#CCFBF1' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--brand)', marginBottom: 6 }}>Hỗ Trợ Thủ Tục Học Vụ</div>
                                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
                                        Sinh viên có thắc mắc liên quan đến bản tin hoặc quyết định học vụ vui lòng liên hệ Văn phòng Giáo vụ Viện hoặc đăng nhập để gửi yêu cầu hỗ trợ.
                                    </p>
                                    <button className="btn btn-primary" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }} onClick={() => setIsLoginModalOpen(true)}>
                                        Đăng nhập Cổng DACN
                                    </button>
                                </div>
                            </aside>
                        </div>
                    </div>
                </main>
            ) : (
                /* ─── MAIN PORTAL HOME VIEW ───────────────────────────────── */
                <main id="portalHomeView">
                    {/* ─── HERO SECTION & LIVE PERIOD DASHBOARD ────────────── */}
                    <section className="hero-banner" id="hero-section" data-od-id="hero-section">
                        <div className="container hero-grid">
                            <div className="hero-copy">
                                <div className="hero-eyebrow">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 14 14" />
                                    </svg>
                                    Hạn chót Đăng ký Đề tài: 24/10/2026 (Còn 10 ngày)
                                </div>

                                <h1 className="hero-title">{portalConfiguration.heroTitle}</h1>

                                <p className="hero-subtitle">
                                    {portalConfiguration.heroDescription}
                                </p>

                                <div className="hero-ctas">
                                    <a
                                        href={portalConfiguration.primaryCtaHref}
                                        className="btn btn-primary"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            scrollToSection(portalConfiguration.primaryCtaHref || 'faculty');
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        <span>{portalConfiguration.primaryCtaLabel}</span>
                                    </a>
                                </div>
                            </div>

                            {/* Live Period Status Card (Exact OpenDesign Prototype) */}
                            <div className="period-widget" data-od-id="period-status-card">
                                <div className="period-widget-header">
                                    <div>
                                        <span className="badge badge-brand">Đợt tốt nghiệp chính thức</span>
                                        <h3 style={{ fontSize: 16, marginTop: 6, color: 'var(--brand)' }}>
                                            {currentSemester?.name || 'Học kỳ 1 · Niên khóa 2026 - 2027'}
                                        </h3>
                                    </div>
                                    <span className="badge badge-success">Đang mở cổng</span>
                                </div>

                                <div className="period-stat-grid">
                                    <div className="period-stat-box">
                                        <div className="period-stat-val" data-count="128">128</div>
                                        <div className="period-stat-lbl">SV đủ điều kiện</div>
                                    </div>
                                    <div className="period-stat-box">
                                        <div className="period-stat-val" data-count="42" style={{ color: 'var(--accent)' }}>42</div>
                                        <div className="period-stat-lbl">Đề tài đã chốt</div>
                                    </div>
                                    <div className="period-stat-box">
                                        <div className="period-stat-val" data-count="86" style={{ color: 'var(--success)' }}>86</div>
                                        <div className="period-stat-lbl">Suất còn trống</div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                                        <span>Tiến độ giai đoạn hiện hành: <strong>GĐ 1 - Đăng ký đề tài</strong></span>
                                        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>32.8%</span>
                                    </div>
                                    <div className="quota-bar-wrapper">
                                        <div className="quota-bar semester-progress-bar" style={{ width: '32.8%' }}></div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                                    <span>Thời gian toàn khóa: <strong>14 tuần</strong></span>
                                    <a
                                        href="#roadmap"
                                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            scrollToSection('roadmap');
                                        }}
                                    >
                                        Xem chi tiết lịch trình &rarr;
                                    </a>
                                </div>
                            </div>
                        </div>

                        <a
                            className="hero-scroll-indicator"
                            href="#roadmap"
                            aria-label="Cuộn xuống xem lộ trình đồ án"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection('roadmap');
                            }}
                        >
                            <span>Khám phá lộ trình</span>
                            <svg className="od-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </a>
                    </section>

                    {/* ─── SECTION: 6-STAGE GUIDED ACADEMIC ROADMAP ──────────── */}
                    <section id="roadmap" className="section roadmap-section" data-od-id="roadmap-section">
                        <div className="container">
                            <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
                                <span className="badge badge-primary">Quy chế đào tạo chính quy</span>
                                <h2 style={{ fontSize: 'var(--fs-h2)', color: 'var(--brand)', marginTop: 10 }}>
                                    Lộ Trình Đồ Án Tốt Nghiệp 6 Chặng
                                </h2>
                                <p style={{ color: 'var(--muted)', marginTop: 8 }}>
                                    Toàn bộ quy trình từ lúc đăng ký đến khi nhận Giấy chứng nhận hoàn thành đồ án được minh bạch hóa với các tiêu chí nghiệm thu rõ ràng.
                                </p>
                            </div>

                            <div className="roadmap-grid">
                                {ROADMAP_STAGES.map((stage) => (
                                    <div
                                        key={stage.step}
                                        className={`roadmap-card ${stage.step === '01' ? 'active' : ''}`}
                                        data-od-id={`stage-card-${stage.step}`}
                                        onClick={() => setSelectedStage(stage)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div>
                                            <div className="roadmap-step-num">CHẶNG {stage.step} · {stage.duration}</div>
                                            <div className="roadmap-title">{stage.title}</div>
                                            <div className="roadmap-desc">{stage.desc}</div>
                                        </div>
                                        <span className={`roadmap-tag ${stage.tagType}`}>{stage.tag}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ─── SECTION: FACULTY DIRECTORY & RESEARCH TOPICS ──────── */}
                    <section id="faculty" className="section" data-od-id="faculty-section">
                        <div className="container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
                                <div>
                                    <span className="badge badge-brand">Danh bạ Học thuật</span>
                                    <h2 style={{ fontSize: 'var(--fs-h2)', color: 'var(--brand)', marginTop: 8 }}>
                                        Giảng Viên Hướng Dẫn & Hướng Nghiên Cứu
                                    </h2>
                                    <p style={{ color: 'var(--muted)', marginTop: 4 }}>
                                        Sinh viên chủ động liên hệ thầy cô theo đúng hướng nghiên cứu thế mạnh. Mỗi GVHD hướng dẫn tối đa 10 sinh viên.
                                    </p>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                    Tổng số: <strong style={{ color: 'var(--fg)' }}>{lecturers.length} Giảng viên cơ hữu</strong> ·{' '}
                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                                        {lecturers.filter((l) => (l._count?.mentoredTopics || 0) < 10).length} GV còn nhận sinh viên
                                    </span>
                                </div>
                            </div>

                            {/* Filter Controls */}
                            <div className="filter-bar">
                                <div className="search-input-box">
                                    <svg
                                        style={{ position: 'absolute', left: 12, top: 10, color: 'var(--muted)', pointerEvents: 'none' }}
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <input
                                        type="text"
                                        id="facultySearch"
                                        placeholder="Tìm kiếm theo tên GV, từ khóa hướng nghiên cứu (AI, Web, IoT...)"
                                        value={facultySearch}
                                        onChange={(e) => setFacultySearch(e.target.value)}
                                        style={{ width: '100%', paddingLeft: 36, border: 'none', outline: 'none', fontSize: 13.5 }}
                                    />
                                </div>
                                <div className="filter-selects">
                                    <select
                                        className="filter-select"
                                        id="deptFilter"
                                        value={deptFilter}
                                        onChange={(e) => setDeptFilter(e.target.value)}
                                    >
                                        <option value="ALL">Tất cả Bộ môn</option>
                                        <option value="Phần mềm">Kỹ thuật Phần mềm (KTPM)</option>
                                        <option value="Máy tính">Khoa học Dữ liệu & AI</option>
                                        <option value="Mạng">Mạng máy tính & An ninh mạng</option>
                                        <option value="Hệ thống">Hệ thống thông tin quản lý</option>
                                    </select>
                                    <select
                                        className="filter-select"
                                        id="quotaFilter"
                                        value={quotaFilter}
                                        onChange={(e) => setQuotaFilter(e.target.value)}
                                    >
                                        <option value="ALL">Tất cả trạng thái suất</option>
                                        <option value="AVAILABLE">Còn nhận sinh viên (dưới 10 SV)</option>
                                        <option value="FULL">Đã đủ 10/10 sinh viên</option>
                                    </select>
                                </div>
                            </div>

                            {/* Faculty Cards Grid (3 Columns Max Fidelity) */}
                            <div className="faculty-grid" id="facultyGridContainer">
                                {filteredLecturers.length > 0 ? (
                                    <>
                                        {(facultyExpanded || filteredLecturers.length <= 5 ? filteredLecturers : filteredLecturers.slice(0, 5)).map((lec) => {
                                            const count = Math.min(10, lec._count?.mentoredTopics || (lec.mentoredTopics?.length ?? 4));
                                            const max = 10;
                                            const isFull = count >= max;
                                            const remain = Math.max(0, max - count);
                                            const initials = getInitials(lec.fullName);
                                            const formattedName = formatAcademicName(lec);

                                            // Deduplicate and limit topics to 3
                                            const topicPills = lec.mentoredTopics && lec.mentoredTopics.length > 0
                                                ? [...new Set(lec.mentoredTopics.map((t) => t.title))].slice(0, 3)
                                                : ['Event-Driven Architecture', 'Distributed Tracing', 'Fintech Core Engine'];

                                            return (
                                                <div key={lec.id} className="faculty-card">
                                                    <div>
                                                        <div className="faculty-header">
                                                            <div className="faculty-avatar">{initials}</div>
                                                            <div>
                                                                <div className="faculty-name">{formattedName}</div>
                                                                <div className="faculty-dept">{lec.department || 'Bộ môn Kỹ thuật Phần mềm'}</div>
                                                            </div>
                                                        </div>

                                                        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                                                            {lec.bio || `Chuyên sâu: Microservices, Cloud-Native Architecture, High-Concurrency Web Systems, Kubernetes Orchestration.`}
                                                        </p>

                                                        <div className="faculty-topics">
                                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                                                                Hướng nghiên cứu gợi ý:
                                                            </div>
                                                            <div className="topic-pill-list">
                                                                {topicPills.map((title, idx) => (
                                                                    <span key={idx} className="topic-pill">
                                                                        {title}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="quota-box">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                                                            <span>Định mức hướng dẫn:</span>
                                                            <strong style={{ color: isFull ? 'var(--danger)' : count >= 8 ? 'var(--warning)' : 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                                                                {count} / {max} SV ({isFull ? 'Đã đủ 10/10 SV' : `Còn ${remain} chỗ`})
                                                            </strong>
                                                        </div>
                                                        <div className="quota-bar-wrapper">
                                                            <div
                                                                className={`quota-bar ${isFull ? 'full' : count >= 8 ? 'near-full' : ''}`}
                                                                style={{ width: `${(count / max) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {filteredLecturers.length > 5 && (
                                            <div
                                                className="faculty-more-card"
                                                id="facultyMoreCard"
                                                onClick={() => setFacultyExpanded(!facultyExpanded)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFacultyExpanded(!facultyExpanded); }}
                                            >
                                                <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                                    {facultyExpanded ? (
                                                        <>
                                                            <line x1="18" y1="15" x2="12" y2="9"/>
                                                            <line x1="6" y1="15" x2="12" y2="9"/>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <line x1="12" y1="5" x2="12" y2="19"/>
                                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                                        </>
                                                    )}
                                                </svg>
                                                <strong>{facultyExpanded ? 'Thu gọn danh bạ Giảng viên' : `Xem toàn bộ ${filteredLecturers.length} Giảng viên`}</strong>
                                                <span>{facultyExpanded ? 'Hiển thị danh bạ 5 giảng viên tiêu biểu' : 'Hiển thị tất cả 4 bộ môn chuyên ngành & định mức hướng dẫn'}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', padding: '48px 20px', textAlign: 'center', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Không tìm thấy giảng viên nào phù hợp với bộ lọc hiện tại.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ─── SECTION: DOWNLOAD & TEMPLATES CENTER ──────────────── */}
                    <section id="downloads" className="section" data-od-id="downloads-section">
                        <div className="container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <span className="badge badge-brand">Kho tài nguyên học vụ</span>
                                    <h2 style={{ fontSize: 'var(--fs-h2)', color: 'var(--brand)', marginTop: 8 }}>
                                        Hệ Thống Biểu Mẫu Chuẩn BM01 – BM05
                                    </h2>
                                    <p style={{ color: 'var(--muted)', marginTop: 4 }}>
                                        Toàn bộ biểu mẫu và văn bản chính thức phục vụ các giai đoạn đăng ký đề tài, duyệt đề cương, theo dõi tiến độ và báo cáo nghiệm thu.
                                    </p>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                    Tổng số: <strong style={{ color: 'var(--fg)' }}>{sortedTemplates.length} biểu mẫu đã ban hành</strong>
                                </div>
                            </div>

                            {sortedTemplates.length === 0 ? (
                                <div style={{ padding: '48px 20px', textAlign: 'center', background: 'white', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border)' }}>
                                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', color: '#94a3b8' }}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
                                        Chưa có biểu mẫu nào được công bố trên Cổng thông tin
                                    </h3>
                                    <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 520, margin: '0 auto' }}>
                                        Các biểu mẫu BM01 đến BM05 đang được rà soát và cập nhật phiên bản mới cho học kỳ hiện tại. Vui lòng liên hệ Văn phòng Giáo vụ Viện nếu bạn cần tài liệu gấp.
                                    </p>
                                </div>
                            ) : (
                                <div className="template-grid">
                                    {sortedTemplates.map((tpl) => {
                                        const isDocx = tpl.mimeType?.includes('word') || tpl.mimeType?.includes('officedocument') || tpl.fileName?.endsWith('.docx') || tpl.fileName?.endsWith('.doc');
                                        const isPdf = tpl.mimeType?.includes('pdf') || tpl.fileName?.endsWith('.pdf');
                                        const isExcel = tpl.mimeType?.includes('excel') || tpl.mimeType?.includes('spreadsheet') || tpl.fileName?.endsWith('.xlsx') || tpl.fileName?.endsWith('.xls');

                                        const extLabel = isDocx ? 'DOCX' : isPdf ? 'PDF' : isExcel ? 'XLSX' : 'FILE';
                                        const iconColor = isDocx ? '#2563EB' : isPdf ? '#E11D48' : isExcel ? '#059669' : '#64748B';
                                        const iconBg = isDocx ? '#EFF6FF' : isPdf ? '#FFF1F2' : isExcel ? '#ECFDF5' : '#F8FAFC';

                                        return (
                                            <div key={tpl.id || tpl.code} className="template-card card-hover">
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span className="template-badge">{tpl.code || 'BM'}</span>
                                                        {tpl.version && (
                                                            <span className="badge" style={{ background: '#F1F5F9', color: '#475569', fontSize: 11, padding: '2px 6px' }}>
                                                                v{tpl.version}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            padding: '4px 8px',
                                                            borderRadius: 6,
                                                            color: iconColor,
                                                            background: iconBg,
                                                            border: `1px solid ${iconColor}25`,
                                                        }}
                                                    >
                                                        {extLabel}
                                                    </div>
                                                </div>

                                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.4, marginBottom: 6 }}>
                                                    {tpl.title || tpl.code}
                                                </h3>

                                                <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16, flexGrow: 1, minHeight: 38 }}>
                                                    {tpl.description || 'Biểu mẫu chuẩn phục vụ quá trình thực hiện và nghiệm thu đồ án tốt nghiệp.'}
                                                </p>

                                                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <div style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }} title={tpl.fileName || tpl.title}>
                                                        {tpl.fileName ? tpl.fileName : `${tpl.code || 'BM'}.${extLabel.toLowerCase()}`}
                                                        {tpl.fileSize ? ` · ${formatFileSize(tpl.fileSize)}` : ''}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                        {tpl.fileUrl ? (
                                                            <a
                                                                className="btn btn-primary"
                                                                style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                                                href={tpl.fileUrl}
                                                                download={tpl.fileName || `${tpl.code}_${tpl.title}.${extLabel.toLowerCase()}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={() => showToast(`Bắt đầu tải về: ${tpl.fileName || tpl.title}`)}
                                                            >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                    <polyline points="7 10 12 15 17 10" />
                                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                                </svg>
                                                                Tải về
                                                            </a>
                                                        ) : (
                                                            <span style={{ fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic' }}>Chưa có tệp</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>


                    {/* ─── SECTION: LATEST ANNOUNCEMENTS ─────────────────────── */}
                    <section id="announcements" className="section" data-od-id="announcements-section">
                        <div className="container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <span className="badge badge-brand">Bản tin học vụ</span>
                                    <h2 style={{ fontSize: 'var(--fs-h2)', color: 'var(--brand)', marginTop: 6 }}>
                                        Bản Tin &amp; Quyết Định Học Vụ Mới Nhất
                                    </h2>
                                </div>
                                <a href="javascript:void(0)" style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 600 }}>
                                    Xem tất cả bản tin &rarr;
                                </a>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                                {announcements.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', padding: '48px 20px', textAlign: 'center', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Hiện chưa có bản tin hoặc quyết định học vụ mới được công bố.</p>
                                    </div>
                                ) : (
                                    announcements.map((ann) => (
                                    <div
                                        key={ann.id}
                                        className="card card-hover"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleOpenAnnouncementDetail(ann)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <span className={`badge ${ann.badgeClass || (ann.category === 'ANNOUNCEMENT' ? 'badge-danger' : 'badge-primary')}`}>
                                                {ann.badge || (ann.category === 'ANNOUNCEMENT' ? 'Khẩn cấp' : 'Quyết định')}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                                {ann.date || ann.issuedDate || (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('vi-VN') : '14/10/2026')}
                                            </span>
                                        </div>

                                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.35, marginBottom: 8 }}>
                                            {ann.cardTitle || ann.title}
                                        </h3>

                                        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
                                            {ann.summary || (ann.content ? ann.content.slice(0, 140) + '...' : 'Nhấp để đọc toàn văn quyết định học vụ chính thức.')}
                                        </p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                                            <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                </svg>
                                                <strong>{ann.fileLabel || (ann.fileName ? '1 tệp đính kèm' : (ann.attachments?.length ? `${ann.attachments.length} tệp` : 'Văn bản điện tử'))}</strong>
                                            </span>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                Đọc chi tiết văn bản &rarr;
                                            </span>
                                        </div>
                                    </div>
                                )))}
                            </div>
                        </div>
                    </section>
                </main>
            )}

            {/* ─── FOOTER ────────────────────────────────────────────────── */}
            <footer className="footer" data-od-id="public-footer">
                <div className="container">
                    <div className="footer-grid">
                        <div>
                            <div className="brand-group" style={{ marginBottom: 14 }}>
                                <img
                                    className="brand-logo"
                                    src="https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/dacn/branding/tdmu-logo.svg"
                                    onError={(e) => { e.currentTarget.src = '/assets/tdmu-logo.svg'; }}
                                    alt="Đại học Thủ Dầu Một"
                                    width="107"
                                    height="40"
                                    style={{
                                        width: 107,
                                        height: 40,
                                        objectFit: 'contain',
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                    }}
                                />
                                <div className="brand-text">
                                    <h1 style={{ color: '#fff', fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>{portalConfiguration.siteTitle}</h1>
                                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>{portalConfiguration.institutionName}</p>
                                </div>
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: '42ch' }}>
                                Hệ thống Quản lý Đồ án Tốt nghiệp chuẩn hóa số hóa toàn diện từ đề cương, tiến độ đến hội đồng bảo vệ và lưu chiểu học thuật.
                            </p>
                            <div style={{ marginTop: 18, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                                {portalConfiguration.address && <>Văn phòng: {portalConfiguration.address}<br /></>}
                                {portalConfiguration.phone && <>Hotline Giáo vụ: {portalConfiguration.phone} · </>}Email: {portalConfiguration.email || 'dacn@tdmu.edu.vn'}
                            </div>
                        </div>

                        <div>
                            <h4>Phân Hệ Chức Năng</h4>
                            <ul className="footer-links">
                                <li><a href="javascript:void(0)" onClick={() => openLoginWithTarget()}>Trang quản trị hệ thống</a></li>
                                <li><a href="javascript:void(0)" onClick={() => openLoginWithTarget()}>Không gian học vụ Giảng viên</a></li>
                                <li><a href="javascript:void(0)" onClick={() => openLoginWithTarget()}>Hành trình đồ án Sinh viên</a></li>
                                <li><a href="javascript:void(0)" onClick={() => openLoginWithTarget()}>Hội đồng & Chấm bảo vệ</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4>Biểu Mẫu &amp; Tài Liệu</h4>
                            <ul className="footer-links">
                                {sortedTemplates.length > 0 ? (
                                    sortedTemplates.slice(0, 4).map((tpl) => (
                                        <li key={tpl.id || tpl.code}>
                                            <a href="#downloads" onClick={() => handleBackToPortal('#downloads')}>
                                                {tpl.code ? `${tpl.code} - ` : ''}{tpl.title}
                                            </a>
                                        </li>
                                    ))
                                ) : (
                                    <>
                                        <li><a href="#downloads" onClick={() => handleBackToPortal('#downloads')}>Kho biểu mẫu BM01 – BM05</a></li>
                                        <li><a href="#downloads" onClick={() => handleBackToPortal('#downloads')}>Quy chuẩn đánh giá khóa luận</a></li>
                                        <li><a href="#downloads" onClick={() => handleBackToPortal('#downloads')}>Mẫu đề cương nghiên cứu</a></li>
                                    </>
                                )}
                            </ul>
                        </div>


                        <div>
                            <h4>Tiêu Chuẩn Hệ Thống</h4>
                            <ul className="footer-links">
                                <li><span style={{ color: '#cbd5e1' }}>WCAG 2.1 AA Compliant</span></li>
                                <li><span style={{ color: '#cbd5e1' }}>Supabase PostgreSQL Backend</span></li>
                                <li><span style={{ color: '#cbd5e1' }}>Bảo mật phân quyền RBAC</span></li>
                                <li><span style={{ color: '#cbd5e1' }}>Tuân thủ mô hình TopicRegistration</span></li>
                            </ul>
                        </div>
                    </div>

                    {linksByGroup.QUICK_LINK.length > 0 && (
                        <div className="footer-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                            {linksByGroup.QUICK_LINK.map((link) => <a key={link.id} href={link.href}>{link.label}</a>)}
                        </div>
                    )}
                    <div style={{ borderTop: '1px solid #1e293b', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#64748b', flexWrap: 'wrap', gap: 12 }}>
                        <div>{portalConfiguration.copyrightText}</div>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {linksByGroup.LEGAL.concat(linksByGroup.SOCIAL).map((link) => <a key={link.id} href={link.href} style={{ color: '#64748b' }}>{link.label}</a>)}
                        </div>
                    </div>
                </div>
            </footer>



            {/* ─── STAGE DETAIL MODAL ─────────────────────────────────────── */}
            <OpenModal
                open={Boolean(selectedStage)}
                onClose={() => setSelectedStage(null)}
                title={selectedStage ? `CHẶNG ${selectedStage.step}: ${selectedStage.title}` : ''}
                maxWidth="600px"
            >
                {selectedStage && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="badge badge-brand">{selectedStage.duration}</span>
                            <span className={`badge ${selectedStage.tagType}`}>{selectedStage.tag}</span>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 6 }}>
                                Mục tiêu & Nội dung công việc:
                            </h4>
                            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg)' }}>
                                {selectedStage.desc}
                            </p>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 6 }}>
                                Sản phẩm bàn giao (Deliverables):
                            </h4>
                            <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border)', fontSize: 13, color: '#334155' }}>
                                {selectedStage.deliverables}
                            </div>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 6 }}>
                                Quy chuẩn kiểm soát học thuật:
                            </h4>
                            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                                {selectedStage.rules}
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedStage(null)}>
                                Đã hiểu quy trình
                            </button>
                        </div>
                    </div>
                )}
            </OpenModal>

            {/* ─── IN-APP ATTACHMENT PREVIEW MODAL (SIMULATED A4 VIEWER) ─── */}
            {previewModalFile && (
                <div
                    className="preview-modal-backdrop show"
                    onClick={() => setPreviewModalFile(null)}
                    style={{ display: 'flex' }}
                >
                    <div className="preview-modal-window" onClick={(e) => e.stopPropagation()}>
                        <div className="preview-modal-toolbar">
                            <div className="preview-toolbar-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <span>{previewModalFile.name}</span>
                                <span className="badge badge-success" style={{ fontSize: 11, padding: '2px 8px' }}>Dấu mộc & Ký số SHA-256</span>
                            </div>
                            <div className="preview-toolbar-actions">
                                <button className="btn btn-secondary" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: 12, background: 'transparent' }} onClick={() => window.print()}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 6 2 18 2 18 9"/>
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                        <rect x="6" y="14" width="12" height="8"/>
                                    </svg>
                                    In PDF
                                </button>
                                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => handleDownloadAttachment(previewModalFile.name)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Tải File
                                </button>
                                <button
                                    className="btn-ghost"
                                    style={{ color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                    onClick={() => setPreviewModalFile(null)}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="preview-viewport">
                            <div className="simulated-a4-page">
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 24 }}>
                                    <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                                        <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ</div>
                                        <div style={{ fontWeight: 700 }}>VIỆN CÔNG NGHỆ SỐ</div>
                                        <div style={{ color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Số: {previewModalFile.doc?.docNumber || '142/TB-VCS-ĐT'}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', fontSize: 12, lineHeight: 1.4 }}>
                                        <div style={{ fontWeight: 700 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                        <div style={{ fontWeight: 700, borderBottom: '1px solid #000', display: 'inline-block', paddingBottom: 2 }}>Độc lập - Tự do - Hạnh phúc</div>
                                        <div style={{ fontStyle: 'italic', color: '#64748b', marginTop: 4 }}>{previewModalFile.doc?.issuedPlace || 'Hà Nội'}, ngày {previewModalFile.doc?.issuedDate || '14/10/2026'}</div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', margin: '24px 0 20px' }}>
                                    <h2 style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', lineHeight: 1.4 }}>{previewModalFile.doc?.title || previewModalFile.title}</h2>
                                    <p style={{ fontSize: 12, fontStyle: 'italic', color: '#64748b', marginTop: 4 }}>{previewModalFile.doc?.subtitle}</p>
                                </div>

                                <div style={{ fontSize: 12.5, lineHeight: 1.7, textAlign: 'justify', marginBottom: 20 }}>
                                    {previewModalFile.doc?.preamble && (
                                        <p style={{ fontStyle: 'italic', marginBottom: 14 }}>{previewModalFile.doc.preamble}</p>
                                    )}
                                    {previewModalFile.doc?.articles?.map((a, i) => (
                                        <div key={i} style={{ marginBottom: 14 }}>
                                            <strong>{a.title}</strong>
                                            <div style={{ marginTop: 2 }}>{a.content || 'Xem bảng phụ lục chi tiết ban hành kèm theo.'}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1', fontSize: 11.5 }}>
                                    <div>
                                        <strong>Nơi nhận:</strong>
                                        {previewModalFile.doc?.recipients?.map((r, i) => <div key={i}>- {r}</div>)}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{previewModalFile.doc?.signerRole || 'KT. VIỆN TRƯỞNG'}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>{previewModalFile.doc?.signerDelegate}</div>
                                        <div style={{ display: 'inline-block', border: '1.5px solid #dc2626', background: '#fef2f2', color: '#991b1b', padding: '6px 12px', borderRadius: 6, fontSize: 10, textAlign: 'left', margin: '8px 0' }}>
                                            <div>[ĐÃ KÝ SỐ ĐIỆN TỬ]</div>
                                            <div>VIỆN CÔNG NGHỆ SỐ - ĐHCN</div>
                                            <div>Ký ngày: {previewModalFile.doc?.issuedDate || '14/10/2026'}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, marginTop: 6 }}>{previewModalFile.doc?.signerName || 'TS. Lê Quang Dũng'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── BACK TO TOP FLOATING BUTTON ─────────────────────────── */}
            <button
                id="backToTopButton"
                className={`back-to-top ${isScrolledPastHero ? 'is-visible' : ''}`}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Quay về đầu trang"
                type="button"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
            </button>

            {/* ─── TOAST NOTIFICATION ────────────────────────────────────── */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2000,
                    background: '#0F172A',
                    color: '#FFFFFF',
                    padding: '12px 24px',
                    borderRadius: 10,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    animation: 'docFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    maxWidth: '90vw',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ─── AUTH MODAL POPUP ─────────────────────────────────────── */}
            <AuthModal
                open={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
        </div>
    );
}
