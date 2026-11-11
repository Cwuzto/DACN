import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Collapse,
    message,
    Modal,
    Popconfirm,
    Tag,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    DeleteOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    SaveOutlined,
} from '@ant-design/icons';
import rubricService from '../../services/rubricService';

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

const DEFAULT_FORMS = [
    {
        code: 'BM01',
        title: 'Đề cương Nghiên cứu Khóa luận Tốt nghiệp',
        sub: 'Bản thuyết minh đề tài, mục tiêu, phương pháp, công nghệ và kế hoạch 15 tuần',
        role: 'Sinh viên & GVHD',
        roleCategory: 'student',
        period: 'Đầu kỳ (Hạn: Tuần 4)',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM01_De_Cuong_Nghien_Cuu_DACN_2026.docx',
        fileSize: '142 KB',
        reviewCouncil: 'Hội đồng Thẩm định Đề cương Pha 2',
        fields: [
            { name: 'Tên đề tài (Tiếng Việt & Tiếng Anh)', type: 'Text', required: true },
            { name: 'Tính cấp thiết & Mục tiêu nghiên cứu', type: 'Textarea', required: true },
            { name: 'Phạm vi & Đối tượng nghiên cứu', type: 'Textarea', required: true },
            { name: 'Công nghệ & Kiến trúc dự kiến', type: 'Text', required: true },
            { name: 'Kế hoạch triển khai chi tiết 15 tuần', type: 'Table / Grid', required: true },
            { name: 'Sản phẩm dự kiến & Demo bàn giao', type: 'Textarea', required: true },
            { name: 'Tài liệu tham khảo chính', type: 'Textarea', required: false },
            { name: 'Tệp đính kèm Thuyết minh toàn văn', type: 'File (.pdf scan có chữ ký)', required: true },
        ],
    },
    {
        code: 'BM02',
        title: 'Đơn Đăng Ký & Giao Nhận Đề Tài Chính Thức',
        sub: 'Văn bản cam kết sau khi đề tài vượt qua thẩm định đề cương; xác nhận GVHD chính thức',
        role: 'Sinh viên, GVHD & Trưởng Bộ Môn',
        roleCategory: 'student',
        period: 'Đầu kỳ (Hạn: Tuần 5)',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM02_Don_Giao_Nhan_De_Tai_DACN_2026.docx',
        fileSize: '118 KB',
        reviewCouncil: 'Phê duyệt của Trưởng Bộ Môn',
        fields: [
            { name: 'Thông tin sinh viên & Mã số SV', type: 'Text', required: true },
            { name: 'Đơn vị / Lớp sinh hoạt', type: 'Text', required: true },
            { name: 'Tên đề tài đã được thẩm định thông qua', type: 'Text', required: true },
            { name: 'Họ tên & Đơn vị công tác GVHD', type: 'Text', required: true },
            { name: 'Cam kết tiến độ và liêm chính học thuật', type: 'Checkbox', required: true },
            { name: 'Xác nhận chữ ký số của GVHD & Trưởng Bộ Môn', type: 'Digital Signature', required: true },
        ],
    },
    {
        code: 'BM03',
        title: 'Sổ Theo Dõi Tiến Độ & Nhật Ký Hướng Dẫn',
        sub: 'Ghi nhận lịch họp Lab, đánh giá Checkpoint Tuần 6 & 11, cảnh báo chậm trễ > 21 ngày',
        role: 'GVHD & Sinh viên',
        roleCategory: 'lecturer',
        period: 'Định kỳ hàng tuần',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM03_Nhat_Ky_Huong_Dan_Lab_DACN_2026.docx',
        fileSize: '164 KB',
        reviewCouncil: 'Giáo vụ Viện & Ban Chủ nhiệm',
        fields: [
            { name: 'Ngày trao đổi & Địa điểm (Lab/Online/Văn phòng)', type: 'Date + Select', required: true },
            { name: 'Tóm tắt nội dung sinh viên đã báo cáo', type: 'Textarea', required: true },
            { name: 'Kế hoạch công việc tuần tiếp theo', type: 'Textarea', required: true },
            { name: 'Nhận xét & Đánh giá thái độ của GVHD', type: 'Textarea', required: true },
            { name: 'Đánh giá mốc Checkpoint (Tuần 6 & Tuần 11)', type: 'Radio (Đạt / Không đạt)', required: true },
        ],
    },
    {
        code: 'BM04',
        title: 'Phiếu Nhận Xét & Thẩm Định Khóa Luận Của GVHD',
        sub: 'Tổng hợp số buổi gặp Lab, cho điểm quá trình và quyết định cho/không cho ra bảo vệ',
        role: 'Giảng viên hướng dẫn',
        roleCategory: 'lecturer',
        period: 'Trước ngày bảo vệ 7 ngày',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM04_Phieu_Nhan_Xet_GVHD_DACN_2026.docx',
        fileSize: '135 KB',
        reviewCouncil: 'Điều kiện xếp Hội đồng bảo vệ',
        fields: [
            { name: 'Tổng số buổi gặp mặt & làm việc thực tế tại Lab', type: 'Number (Tự động tính)', required: true },
            { name: 'Đánh giá tinh thần, thái độ và sự chủ động', type: 'Textarea', required: true },
            { name: 'Đánh giá chất lượng sản phẩm & Báo cáo', type: 'Textarea', required: true },
            { name: 'Điểm đánh giá quá trình (Thang 10 - Hệ số 20%)', type: 'Number (0 - 10)', required: true },
            { name: 'Kết luận: Cho phép bảo vệ / Không đồng ý bảo vệ', type: 'Radio (Quyết định pháp lý)', required: true },
        ],
    },
    {
        code: 'BM05',
        title: 'Biên Bản Họp Hội Đồng & Phiếu Điểm Chi Tiết Rubric',
        sub: 'Tổng hợp điểm của 4 thành viên Hội đồng, chữ ký điện tử Chủ tịch & Thư ký',
        role: 'Hội đồng Bảo vệ & Thư ký',
        roleCategory: 'council',
        period: 'Tại buổi lễ bảo vệ',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM05_Bien_Ban_Hoi_Dong_Rubric_DACN_2026.docx',
        fileSize: '210 KB',
        reviewCouncil: 'Quyết định Điểm Khóa Luận Chính thức',
        fields: [
            { name: 'Thành phần Hội đồng & Danh sách Sinh viên', type: 'Table Header', required: true },
            { name: 'Bảng điểm chi tiết 4 tiêu chí Rubric từng giám khảo', type: 'Rubric Matrix', required: true },
            { name: 'Nhận xét chuyên môn của Hội đồng', type: 'Textarea', required: true },
            { name: 'Điểm tổng hợp: GVHD (20%) + PB (20%) + HĐ (60%)', type: 'Auto Calculated', required: true },
            { name: 'Chữ ký số xác nhận của Chủ tịch & Thư ký', type: 'Digital Signature', required: true },
        ],
    },
    {
        code: 'BM06',
        title: 'Giấy Chứng Nhận Hoàn Tất Hồ Sơ & Nộp Lưu Chiểu Số',
        sub: 'Thư viện số và Giáo vụ xác nhận mã Hash nộp bản toàn văn & mã nguồn hoàn chỉnh',
        role: 'Sinh viên & Thư viện / Giáo vụ',
        roleCategory: 'student',
        period: 'Sau bảo vệ 10 ngày',
        version: 'v2.4',
        status: 'active',
        updatedAt: '15/10/2026',
        fileFormat: '.docx / .pdf',
        fileName: 'BM06_Chung_Nhan_Luu_Chieu_So_DACN_2026.docx',
        fileSize: '115 KB',
        reviewCouncil: 'Điều kiện xét Tốt nghiệp & Ra trường',
        fields: [
            { name: 'Mã số đề tài & Thông tin sinh viên', type: 'Text', required: true },
            { name: 'Đường dẫn Git Repository lưu chiểu', type: 'URL', required: true },
            { name: 'Mã băm SHA-256 bản toàn văn (.pdf)', type: 'Hash String', required: true },
            { name: 'Xác nhận của Thư viện trường & Viện CNS', type: 'QR Code Stamp', required: true },
        ],
    },
];

export default function RubricManagementPage() {
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState([]);
    const [systemEditable, setSystemEditable] = useState(true);
    const [systemEditableReason, setSystemEditableReason] = useState('');

    // Tab state: 'catalog' | 'rubric' | 'history'
    const [activeTab, setActiveTab] = useState('catalog');

    // Forms Catalog search & filter state
    const [formsSearch, setFormsSearch] = useState('');
    const [formsRoleFilter, setFormsRoleFilter] = useState('all');
    const [previewForm, setPreviewForm] = useState(null);

    // Active Rubric Editing state (Tab 2)
    const [activeRubricId, setActiveRubricId] = useState(null);
    const [formTitle, setFormTitle] = useState('Barem đánh giá bảo vệ đồ án tốt nghiệp khóa mới');
    const [formDescription, setFormDescription] = useState('Barem đánh giá chuẩn hóa theo quy chế học vụ.');
    const [formCategories, setFormCategories] = useState([]);
    const [saving, setSaving] = useState(false);

    // Clone Modal state
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [cloneSourceId, setCloneSourceId] = useState(null);
    const [cloneVersionName, setCloneVersionName] = useState('');
    const [cloneTitle, setCloneTitle] = useState('');
    const [cloning, setCloning] = useState(false);

    // Tải danh sách các phiên bản Rubric từ backend
    const fetchRubrics = async () => {
        try {
            setLoading(true);
            const res = await rubricService.getRubricVersions();
            if (res.success && res.data) {
                const verList = res.data.versions || [];
                setVersions(verList);
                setSystemEditable(res.data.systemEditable !== undefined ? Boolean(res.data.systemEditable) : true);
                setSystemEditableReason(res.data.systemEditableReason || '');

                // Tự động load active rubric vào builder nếu có
                const currentActive = verList.find((v) => v.isActive) || verList[0];
                if (currentActive && !activeRubricId) {
                    loadRubricDetails(currentActive.id);
                }
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải danh sách Rubric');
        } finally {
            setLoading(false);
        }
    };

    const loadRubricDetails = async (rubricId) => {
        try {
            setLoading(true);
            const res = await rubricService.getRubricById(rubricId);
            if (res.success && res.data) {
                const r = res.data;
                setActiveRubricId(r.id);
                setFormTitle(r.title);
                setFormDescription(r.description || '');
                setFormCategories(
                    (r.categories || []).map((cat) => ({
                        ...cat,
                        criteria: (cat.criteria || []).map((cri) => ({ ...cri })),
                    }))
                );
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải chi tiết phiên bản Rubric');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRubrics();
    }, []);

    // Active version summary
    const activeVersionObj = useMemo(() => {
        return versions.find((v) => v.isActive) || versions[0] || null;
    }, [versions]);

    // Filtered Forms
    const filteredForms = useMemo(() => {
        return DEFAULT_FORMS.filter((f) => {
            const matchSearch =
                !formsSearch ||
                f.code.toLowerCase().includes(formsSearch.toLowerCase()) ||
                f.title.toLowerCase().includes(formsSearch.toLowerCase()) ||
                f.sub.toLowerCase().includes(formsSearch.toLowerCase());
            const matchRole = formsRoleFilter === 'all' || f.roleCategory === formsRoleFilter;
            return matchSearch && matchRole;
        });
    }, [formsSearch, formsRoleFilter]);

    // Real-time calculation of total score
    const totalScore = useMemo(() => {
        const sum = formCategories.reduce((acc, cat) => acc + (Number(cat.maxScore) || 0), 0);
        return round2(sum);
    }, [formCategories]);

    const totalCriteriaCount = useMemo(() => {
        return formCategories.reduce((acc, cat) => acc + (cat.criteria?.length || 0), 0);
    }, [formCategories]);

    const isScoreValid = totalScore === 10.0;

    // Builder manipulations
    const handleAddCategory = () => {
        const nextIdx = formCategories.length + 1;
        setFormCategories((prev) => [
            ...prev,
            {
                id: `cat_new_${Date.now()}`,
                code: `CAT_${nextIdx}`,
                name: `${nextIdx}. Nhóm mục mới`,
                description: '',
                maxScore: 1.0,
                criteria: [
                    {
                        id: `cri_new_${Date.now()}`,
                        code: `CRI_${nextIdx}_1`,
                        label: 'Tiêu chí mới',
                        description: '',
                        maxScore: 1.0,
                    },
                ],
            },
        ]);
    };

    const handleDeleteCategory = (catIndex) => {
        setFormCategories((prev) => prev.filter((_, idx) => idx !== catIndex));
    };

    const handleUpdateCategory = (catIndex, field, value) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => (idx === catIndex ? { ...cat, [field]: value } : cat))
        );
    };

    const handleAddCriterion = (catIndex) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                const nextCriIdx = (cat.criteria || []).length + 1;
                return {
                    ...cat,
                    criteria: [
                        ...(cat.criteria || []),
                        {
                            id: `cri_new_${Date.now()}_${nextCriIdx}`,
                            code: `${cat.code || 'CAT'}_CRI_${nextCriIdx}`,
                            label: `Tiêu chí ${nextCriIdx}`,
                            description: '',
                            cloCode: 'CLO1',
                            descGood: 'Thể hiện xuất sắc, vượt yêu cầu chuẩn đầu ra.',
                            descFair: 'Đáp ứng tốt các yêu cầu chuẩn đầu ra.',
                            descAverage: 'Đáp ứng mức cơ bản chuẩn đầu ra.',
                            descPoor: 'Chưa đạt yêu cầu chuẩn đầu ra.',
                            maxScore: 0.5,
                        },
                    ],
                };
            })
        );
    };

    const handleLockRubric = async (id) => {
        const targetId = id || activeRubricId;
        if (!targetId) {
            message.warning('Vui lòng chọn một phiên bản Rubric để khóa.');
            return;
        }
        try {
            setLoading(true);
            const res = await rubricService.lockRubric(targetId);
            if (res.success) {
                message.success('Đã khóa phiên bản Rubric cho đợt bảo vệ!');
                fetchRubrics();
                loadRubricDetails(targetId);
            }
        } catch (error) {
            message.error(error.message || 'Không thể khóa phiên bản Rubric');
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreDefaultRubric = async (id) => {
        const targetId = id || activeRubricId;
        if (!targetId) {
            message.warning('Vui lòng chọn một phiên bản Rubric để khôi phục.');
            return;
        }
        try {
            setLoading(true);
            const res = await rubricService.restoreDefault(targetId);
            if (res.success) {
                message.success('Đã khôi phục barem mẫu chuẩn 4 nhóm 14 mục (10.0đ)!');
                fetchRubrics();
                loadRubricDetails(targetId);
            }
        } catch (error) {
            message.error(error.message || 'Không thể khôi phục barem mẫu chuẩn');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCriterion = (catIndex, criIndex) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                return {
                    ...cat,
                    criteria: cat.criteria.filter((_, cIdx) => cIdx !== criIndex),
                };
            })
        );
    };

    const handleUpdateCriterion = (catIndex, criIndex, field, value) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                return {
                    ...cat,
                    criteria: cat.criteria.map((cri, cIdx) =>
                        cIdx === criIndex ? { ...cri, [field]: value } : cri
                    ),
                };
            })
        );
    };

    // Save rubric builder changes
    const handleSaveRubric = async () => {
        if (!isScoreValid) {
            message.warning(`Tổng điểm toàn barem hiện tại là ${totalScore}đ. Bắt buộc phải bằng chính xác 10.0đ.`);
            return;
        }

        for (const cat of formCategories) {
            const sumCri = round2(
                (cat.criteria || []).reduce((sum, cri) => sum + (Number(cri.maxScore) || 0), 0)
            );
            if (sumCri !== Number(cat.maxScore)) {
                message.warning(
                    `Tổng điểm tiêu chí trong nhóm "${cat.name}" là ${sumCri}đ, chưa khớp với điểm nhóm (${cat.maxScore}đ).`
                );
                return;
            }
        }

        try {
            setSaving(true);
            const payload = {
                title: formTitle.trim(),
                description: formDescription.trim(),
                categories: formCategories.map((cat, catIdx) => ({
                    code: cat.code.trim().toUpperCase(),
                    name: cat.name.trim(),
                    description: cat.description ? cat.description.trim() : null,
                    maxScore: Number(cat.maxScore),
                    orderIndex: catIdx + 1,
                    criteria: (cat.criteria || []).map((cri, criIdx) => ({
                        code: cri.code.trim().toUpperCase(),
                        label: cri.label.trim(),
                        description: cri.description ? cri.description.trim() : null,
                        cloCode: cri.cloCode ? cri.cloCode.trim() : null,
                        descGood: cri.descGood || null,
                        descFair: cri.descFair || null,
                        descAverage: cri.descAverage || null,
                        descPoor: cri.descPoor || null,
                        maxScore: Number(cri.maxScore),
                        orderIndex: criIdx + 1,
                    })),
                })),
            };

            if (activeRubricId) {
                const res = await rubricService.updateRubric(activeRubricId, payload);
                if (res.success) {
                    message.success('Đã lưu cấu hình Rubric thành công!');
                    fetchRubrics();
                }
            } else {
                payload.version = `v${versions.length + 1}`;
                const res = await rubricService.createRubric(payload);
                if (res.success) {
                    message.success('Đã tạo phiên bản Rubric mới thành công!');
                    fetchRubrics();
                }
            }
        } catch (error) {
            message.error(error.message || 'Lưu phiên bản Rubric thất bại');
        } finally {
            setSaving(false);
        }
    };

    // Reset to default rubric
    const handleResetToDefault = () => {
        setFormCategories([
            {
                id: 'cat_def_1',
                code: 'CAT_RESEARCH_ORIGINALITY',
                name: '1. Tính Khoa học, Tính Mới & Độ phức tạp Đề tài',
                description: 'Đánh giá phương pháp luận, khối lượng nghiên cứu và tính ứng dụng thực tiễn',
                maxScore: 2.5,
                criteria: [
                    {
                        id: 'cri_1_1',
                        code: 'METHODOLOGY',
                        label: 'Phương pháp luận & Mô hình giải thuật',
                        description: 'Áp dụng mô hình chuẩn, giải thuật tối ưu, cơ sở lý thuyết vững chắc.',
                        maxScore: 1.5,
                    },
                    {
                        id: 'cri_1_2',
                        code: 'COMPLEXITY',
                        label: 'Độ phức tạp và phạm vi đề tài',
                        description: 'Khối lượng công việc tương xứng với khóa luận tốt nghiệp.',
                        maxScore: 1.0,
                    },
                ],
            },
            {
                id: 'cat_def_2',
                code: 'CAT_PRODUCT_CODEBASE',
                name: '2. Sản phẩm Thực nghiệm, Demo Ứng dụng & Codebase',
                description: 'Chất lượng kiến trúc phần mềm, khả năng vận hành ổn định, test coverage',
                maxScore: 3.5,
                criteria: [
                    {
                        id: 'cri_2_1',
                        code: 'ARCHITECTURE',
                        label: 'Kiến trúc hệ thống & Clean Code',
                        description: 'Phân tầng rõ ràng, áp dụng design pattern, tài liệu mã nguồn đầy đủ.',
                        maxScore: 2.0,
                    },
                    {
                        id: 'cri_2_2',
                        code: 'STABILITY_TEST',
                        label: 'Khả năng vận hành và kiểm thử tự động',
                        description: 'Demo chạy mượt mà trên môi trường thật, không có lỗi nghiêm trọng.',
                        maxScore: 1.5,
                    },
                ],
            },
            {
                id: 'cat_def_3',
                code: 'CAT_PRESENTATION_QA',
                name: '3. Kỹ năng Thuyết trình & Trả lời Câu hỏi Phản biện',
                description: 'Slide trực quan, phong thái tự tin, trả lời đúng trọng tâm câu hỏi của HĐ',
                maxScore: 2.5,
                criteria: [
                    {
                        id: 'cri_3_1',
                        code: 'SLIDE_COMMUNICATION',
                        label: 'Thuyết trình mạch lạc, làm chủ thời gian',
                        description: 'Trình bày xúc tích, slide trực quan, giọng nói rõ ràng.',
                        maxScore: 1.0,
                    },
                    {
                        id: 'cri_3_2',
                        code: 'DEFENSE_QA',
                        label: 'Trả lời chất vấn chuyên môn của Hội đồng',
                        description: 'Phản ứng nhanh nhẹn, lập luận chặt chẽ, hiểu sâu giải pháp.',
                        maxScore: 1.5,
                    },
                ],
            },
            {
                id: 'cat_def_4',
                code: 'CAT_REPORT_INTEGRITY',
                name: '4. Quy cách Báo cáo & Tính Liêm chính Học thuật',
                description: 'Định dạng chuẩn Viện, trích dẫn chuẩn IEEE, tỷ lệ kiểm tra Turnitin < 15%',
                maxScore: 1.5,
                criteria: [
                    {
                        id: 'cri_4_1',
                        code: 'FORMAT_CITATIONS',
                        label: 'Quy cách văn bản & Định dạng chuẩn Viện',
                        description: 'Tuân thủ BM01 - BM05, mục lục, bảng biểu rõ ràng.',
                        maxScore: 1.0,
                    },
                    {
                        id: 'cri_4_2',
                        code: 'ACADEMIC_INTEGRITY',
                        label: 'Liêm chính học thuật (Turnitin < 15%)',
                        description: 'Trích dẫn nguồn trung thực, không sao chép trái phép.',
                        maxScore: 0.5,
                    },
                ],
            },
        ]);
        message.info('Đã khôi phục bảng tiêu chuẩn Rubric mẫu chuẩn 10.00đ');
    };

    // Open clone modal
    const handleOpenClone = (rubric) => {
        setCloneSourceId(rubric.id);
        setCloneVersionName(`v${versions.length + 1}`);
        setCloneTitle(`Bản sao của ${rubric.title}`);
        setCloneModalOpen(true);
    };

    // Submit clone
    const handleCloneSubmit = async () => {
        if (!cloneVersionName.trim()) {
            message.warning('Vui lòng nhập mã phiên bản mới');
            return;
        }
        try {
            setCloning(true);
            const res = await rubricService.createRubric({
                version: cloneVersionName.trim().toLowerCase(),
                title: cloneTitle.trim(),
                cloneFromId: cloneSourceId,
            });

            if (res.success) {
                message.success('Đã nhân bản phiên bản mới thành công!');
                setCloneModalOpen(false);
                fetchRubrics();
                loadRubricDetails(res.data.id);
                setActiveTab('rubric');
            }
        } catch (error) {
            message.error(error.message || 'Nhân bản thất bại');
        } finally {
            setCloning(false);
        }
    };

    // Activate rubric version
    const handleActivate = async (rubricId) => {
        try {
            setLoading(true);
            const res = await rubricService.activateRubric(rubricId);
            if (res.success) {
                message.success('Đã kích hoạt phiên bản làm Barem chính thức của hệ thống!');
                fetchRubrics();
            }
        } catch (error) {
            message.error(error.message || 'Kích hoạt thất bại');
        } finally {
            setLoading(false);
        }
    };

    // Delete rubric version
    const handleDelete = async (rubricId) => {
        try {
            setLoading(true);
            const res = await rubricService.deleteRubric(rubricId);
            if (res.success) {
                message.success('Đã xóa phiên bản nháp thành công');
                fetchRubrics();
            }
        } catch (error) {
            message.error(error.message || 'Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-forms">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">ACADEMIC SPECIFICATIONS & FORM TEMPLATES · 2026</p>
                    <h1 className="h1">Quản lý Biểu mẫu Học vụ & Tiêu chuẩn Rubric Đánh giá</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                        Hệ thống quản lý, biên tập và ban hành các biểu mẫu chuẩn (BM01 – BM05) cùng bảng tiêu chí Rubric đánh giá khóa luận tốt nghiệp toàn Viện.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setActiveRubricId(null);
                            setFormTitle('Barem đánh giá bảo vệ đồ án tốt nghiệp khóa mới');
                            handleResetToDefault();
                            setActiveTab('rubric');
                        }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Thêm Phiên Bản Mới</span>
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            if (activeRubricId) {
                                handleActivate(activeRubricId);
                            } else {
                                message.info('Vui lòng chọn một phiên bản để ban hành.');
                            }
                        }}
                    >
                        <span>Ban Hành Phiên Bản</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
                <div className="card" style={{ padding: 16 }}>
                    <div className="meta" style={{ marginBottom: 4 }}>Biểu mẫu Học vụ Chuẩn</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div className="num" style={{ fontSize: 24, fontBold: 700, color: 'var(--institutional)', fontWeight: 700 }}>
                            {DEFAULT_FORMS.length} Biểu mẫu
                        </div>
                        <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                            Đang hiệu lực 100%
                        </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>BM01 → BM06 & Rubric V1 chuẩn hóa</div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                    <div className="meta" style={{ marginBottom: 4 }}>Thang Điểm Rubric Khóa Luận</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div className="num" style={{ fontSize: 24, fontWeight: 700, color: isScoreValid ? 'var(--accent)' : 'var(--danger)' }}>
                            {totalScore.toFixed(2)}đ
                        </div>
                        <span
                            className="status-badge"
                            style={{
                                background: isScoreValid ? 'var(--accent-soft)' : 'var(--danger-soft)',
                                color: isScoreValid ? 'var(--accent)' : 'var(--danger)',
                            }}
                        >
                            {isScoreValid ? '✓ Chuẩn Thang 10' : '⚠ Lệch Điểm'}
                        </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                        {totalCriteriaCount} tiêu chí · {formCategories.length} nhóm đánh giá
                    </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                    <div className="meta" style={{ marginBottom: 4 }}>Quy chuẩn Nộp Hồ sơ</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>Nộp Hybrid</div>
                        <span className="status-badge" style={{ background: '#F1F5F9', color: 'var(--muted)' }}>
                            Số hóa & Chữ ký
                        </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>Form trực tuyến + Bản quét PDF có chữ ký</div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                    <div className="meta" style={{ marginBottom: 4 }}>Phiên bản Ban hành</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>
                            {activeVersionObj?.version?.toUpperCase() || 'v2.4'}
                        </div>
                        <span className="status-badge" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                            Ban Chủ Nhiệm
                        </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>Áp dụng cho Học kỳ hiện hành (2026 - 2027)</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="council-phase-nav" style={{ marginBottom: 20 }}>
                <button
                    className={`phase-nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
                    onClick={() => setActiveTab('catalog')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>1. Danh mục Biểu mẫu Học vụ (BM01 – BM06)</span>
                </button>
                <button
                    className={`phase-nav-btn ${activeTab === 'rubric' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rubric')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span>2. Biên tập Tiêu chuẩn Rubric Đánh giá</span>
                </button>
                <button
                    className={`phase-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>3. Lịch sử Phiên bản & Quyết định Ban hành ({versions.length})</span>
                </button>
            </div>

            {/* TAB 1: DANH MỤC BIỂU MẪU */}
            {activeTab === 'catalog' && (
                <div>
                    {/* Search & Filter Controls */}
                    <div
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '14px 18px',
                            marginBottom: 18,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                        }}
                    >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 260 }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Tìm theo mã BM, tên biểu mẫu, đối tượng..."
                                    style={{ paddingLeft: 34, width: '100%' }}
                                    value={formsSearch}
                                    onChange={(e) => setFormsSearch(e.target.value)}
                                />
                                <svg
                                    style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)', pointerEvents: 'none' }}
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                            <select
                                className="select-field"
                                value={formsRoleFilter}
                                onChange={(e) => setFormsRoleFilter(e.target.value)}
                                style={{ width: 180, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)' }}
                            >
                                <option value="all">Tất cả đối tượng</option>
                                <option value="student">Dành cho Sinh viên</option>
                                <option value="lecturer">Dành cho Giảng viên</option>
                                <option value="council">Dành cho Hội đồng</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setFormsSearch('');
                                    setFormsRoleFilter('all');
                                }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                                <span>Làm mới</span>
                            </button>
                        </div>
                    </div>

                    {/* Forms Cards Grid */}
                    <div className="forms-grid">
                        {filteredForms.map((form) => (
                            <div className="form-card" key={form.code}>
                                <div>
                                    <div className="form-card-top">
                                        <span className="form-code-pill">
                                            <span>{form.code}</span>
                                            <span style={{ fontSize: 10, opacity: 0.8 }}>({form.version})</span>
                                        </span>
                                        <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                            Chuẩn ban hành
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>{form.title}</h3>
                                    <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 14 }}>{form.sub}</p>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                        <span className="form-field-badge">👤 {form.role}</span>
                                        <span className="form-field-badge">⏱ {form.period}</span>
                                        <span className="form-field-badge">⚖ {form.reviewCouncil}</span>
                                    </div>

                                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                                            Các trường thông tin bắt buộc ({form.fields.length}):
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {form.fields.slice(0, 4).map((fld, idx) => (
                                                <span key={idx} style={{ fontSize: 11, background: '#fff', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: '#334155' }}>
                                                    {fld.name.length > 28 ? fld.name.slice(0, 28) + '...' : fld.name}
                                                </span>
                                            ))}
                                            {form.fields.length > 4 && (
                                                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, padding: '2px 4px' }}>
                                                    +{form.fields.length - 4} trường khác
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                        <span>{form.fileName}</span>
                                        <span style={{ marginLeft: 6, opacity: 0.8 }}>({form.fileSize})</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setPreviewForm(form)}
                                            style={{ padding: '4px 10px', fontSize: 12 }}
                                        >
                                            Xem Mẫu
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => message.success(`Đang tải mẫu chuẩn: ${form.fileName}`)}
                                            style={{ padding: '4px 10px', fontSize: 12 }}
                                        >
                                            Tải .docx
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: BIÊN TẬP RUBRIC BUILDER */}
            {activeTab === 'rubric' && (
                <div>
                    {/* High Privilege Admin Notice Banner */}
                    <div
                        style={{
                            background: '#F0FDFA',
                            border: '1px solid #CCFBF1',
                            borderRadius: 'var(--radius-lg)',
                            padding: '14px 18px',
                            marginBottom: 20,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 14,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: '#CCFBF1',
                                    color: '#0F766E',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0,
                                    fontWeight: 700,
                                }}
                            >
                                ⚙
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: 14 }}>
                                    Thẩm quyền Quản trị viên Viện & Ban Chủ Nhiệm
                                </div>
                                <p style={{ fontSize: 12.5, color: '#115E59', marginTop: 2 }}>
                                    Chỉ tài khoản Quản trị viên mới có quyền điều chỉnh tên tiêu chí, hướng dẫn và điểm tối đa của từng mục. Toàn bộ thay đổi sẽ lập tức đồng bộ thời gian thực đến giao diện chấm điểm của các Hội đồng và Giảng viên.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSaveRubric}
                                loading={saving}
                            >
                                {saving ? 'Đang lưu...' : 'Lưu Cấu Hình Rubric'}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => handleRestoreDefaultRubric(activeRubricId)}
                            >
                                Khôi phục mẫu chuẩn
                            </Button>
                            <Button
                                icon={<LockOutlined />}
                                onClick={() => handleLockRubric(activeRubricId)}
                            >
                                Khóa Rubric đợt bảo vệ
                            </Button>
                        </div>
                    </div>

                    {/* Scale Integrity Validation Card */}
                    <div
                        className="card"
                        style={{
                            padding: '16px 20px',
                            marginBottom: 20,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 14,
                        }}
                    >
                        <div>
                            <span className="eyebrow">SCALE INTEGRITY VALIDATION</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>
                                Tổng Điểm Thang Rubric Hiện Tại
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                Quy chế yêu cầu tổng điểm tối đa của toàn bộ các tiêu chí phải đạt chính xác 10.00đ
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div
                                    className="num"
                                    style={{
                                        fontSize: 32,
                                        fontWeight: 900,
                                        color: isScoreValid ? 'var(--institutional)' : 'var(--danger)',
                                        lineHeight: 1,
                                    }}
                                >
                                    {totalScore.toFixed(2)}đ
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: isScoreValid ? 'var(--success)' : 'var(--danger)',
                                        marginTop: 4,
                                    }}
                                >
                                    {isScoreValid
                                        ? '✓ Tổng điểm chính xác 10.00đ'
                                        : `⚠ Chênh lệch: ${(totalScore - 10).toFixed(2)}đ so với thang chuẩn 10.0đ`}
                                </div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={handleAddCategory}>
                                + Thêm Nhóm Tiêu Chí
                            </button>
                        </div>
                    </div>

                    {/* Rubric Metadata inputs */}
                    <div
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '16px 20px',
                            marginBottom: 20,
                        }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                                    Tên Barem / Phiên bản
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    style={{ width: '100%', marginTop: 6, fontWeight: 600 }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                                    Mô tả Quy chế Áp dụng
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    style={{ width: '100%', marginTop: 6 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Groups Container */}
                    <div>
                        {formCategories.map((cat, catIdx) => {
                            const catSum = round2(
                                (cat.criteria || []).reduce((acc, c) => acc + (Number(c.maxScore) || 0), 0)
                            );
                            const catBalanced = catSum === Number(cat.maxScore);

                            return (
                                <div className="rubric-admin-group" key={cat.id || catIdx}>
                                    <div className="rubric-admin-group-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                                {cat.code || `CAT_${catIdx + 1}`}
                                            </span>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={cat.name}
                                                onChange={(e) => handleUpdateCategory(catIdx, 'name', e.target.value)}
                                                style={{ fontWeight: 700, fontSize: 14, flex: 1, maxWidth: 480 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                                <span style={{ color: 'var(--muted)' }}>Điểm nhóm:</span>
                                                <input
                                                    type="number"
                                                    className="rubric-score-input"
                                                    step="0.1"
                                                    min="0.1"
                                                    max="10"
                                                    value={cat.maxScore}
                                                    onChange={(e) => handleUpdateCategory(catIdx, 'maxScore', e.target.value)}
                                                    style={{ width: 60, height: 30, fontWeight: 700 }}
                                                />
                                                <span style={{ fontWeight: 700 }}>đ</span>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    background: catBalanced ? 'var(--success-soft)' : 'var(--danger-soft)',
                                                    color: catBalanced ? 'var(--success)' : 'var(--danger)',
                                                }}
                                            >
                                                {catBalanced ? 'Khớp tổng' : `Lệch: ${catSum}đ / ${cat.maxScore}đ`}
                                            </span>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleAddCriterion(catIdx)}
                                                style={{ padding: '4px 8px', fontSize: 11.5 }}
                                            >
                                                + Tiêu chí
                                            </button>
                                            <Popconfirm
                                                title="Xóa nhóm tiêu chí này?"
                                                onConfirm={() => handleDeleteCategory(catIdx)}
                                                okText="Xóa"
                                                cancelText="Hủy"
                                            >
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                                >
                                                    ✕
                                                </button>
                                            </Popconfirm>
                                        </div>
                                    </div>

                                    {/* Criteria rows */}
                                    <div>
                                        {(cat.criteria || []).map((cri, criIdx) => (
                                            <div
                                                className="rubric-admin-row"
                                                key={cri.id || criIdx}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '140px 1fr 140px 40px',
                                                    gap: 12,
                                                    alignItems: 'start',
                                                    padding: '12px 0',
                                                    borderBottom: '1px solid var(--border-light, #f1f5f9)',
                                                }}
                                            >
                                                <div>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={cri.code || ''}
                                                        onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'code', e.target.value)}
                                                        placeholder="Mã tiêu chí"
                                                        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={cri.cloCode || ''}
                                                        onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'cloCode', e.target.value)}
                                                        placeholder="Mã CLO (VD: CLO1)"
                                                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 4, width: '100%' }}
                                                    />
                                                </div>
                                                <div>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={cri.label}
                                                        onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'label', e.target.value)}
                                                        placeholder="Tên tiêu chí"
                                                        style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, width: '100%' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        value={cri.description || ''}
                                                        onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'description', e.target.value)}
                                                        placeholder="Hướng dẫn chấm điểm cho giám khảo..."
                                                        style={{ fontSize: 12, color: 'var(--muted)', width: '100%', marginBottom: 6 }}
                                                    />
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                                                        <div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', display: 'block' }}>Tốt (85-100%):</span>
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                value={cri.descGood || ''}
                                                                onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'descGood', e.target.value)}
                                                                placeholder="Mức Tốt"
                                                                style={{ fontSize: 11, width: '100%' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', display: 'block' }}>Khá (70-84%):</span>
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                value={cri.descFair || ''}
                                                                onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'descFair', e.target.value)}
                                                                placeholder="Mức Khá"
                                                                style={{ fontSize: 11, width: '100%' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', display: 'block' }}>Trung bình (50-69%):</span>
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                value={cri.descAverage || ''}
                                                                onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'descAverage', e.target.value)}
                                                                placeholder="Mức TB"
                                                                style={{ fontSize: 11, width: '100%' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', display: 'block' }}>Kém (&lt;50%):</span>
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                value={cri.descPoor || ''}
                                                                onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'descPoor', e.target.value)}
                                                                placeholder="Mức Kém"
                                                                style={{ fontSize: 11, width: '100%' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', paddingTop: 4 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tối đa:</span>
                                                    <input
                                                        type="number"
                                                        className="rubric-score-input"
                                                        step="0.1"
                                                        min="0.1"
                                                        max="10"
                                                        value={cri.maxScore}
                                                        onChange={(e) => handleUpdateCriterion(catIdx, criIdx, 'maxScore', e.target.value)}
                                                        style={{ width: 55, height: 28, fontSize: 12, fontWeight: 700 }}
                                                    />
                                                    <span style={{ fontSize: 12, fontWeight: 600 }}>đ</span>
                                                </div>
                                                <div style={{ paddingTop: 4 }}>
                                                    <button
                                                        className="btn-icon-only"
                                                        onClick={() => handleDeleteCriterion(catIdx, criIdx)}
                                                        style={{ color: 'var(--danger)', fontSize: 14 }}
                                                        title="Xóa tiêu chí"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: LỊCH SỬ PHIÊN BẢN */}
            {activeTab === 'history' && (
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 className="h3">Nhật Ký Ban Hành Biểu Mẫu & Cập Nhật Rubric</h3>
                        <span className="meta">{versions.length} phiên bản trong cơ sở dữ liệu</span>
                    </div>

                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Phiên bản</th>
                                    <th>Tên Barem</th>
                                    <th>Mô tả / Căn cứ</th>
                                    <th style={{ textAlign: 'center' }}>Nhóm & Tiêu chí</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày cập nhật</th>
                                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map((ver) => (
                                    <tr key={ver.id}>
                                        <td>
                                            <span className="num" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                                                {ver.version.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{ver.title}</strong>
                                        </td>
                                        <td style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 300 }}>
                                            {ver.description || 'Theo quy chế đào tạo hiện hành'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-approved">
                                                {ver.categoryCount || ver.categories?.length || 4} nhóm · {ver.criteriaCount || 14} mục
                                            </span>
                                        </td>
                                        <td>
                                            {ver.isActive ? (
                                                <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                                    Đang áp dụng
                                                </span>
                                            ) : ver.status === 'ARCHIVED' ? (
                                                <span className="status-badge" style={{ background: '#F1F5F9', color: 'var(--muted)' }}>
                                                    Lưu trữ
                                                </span>
                                            ) : (
                                                <span className="status-badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                                                    Bản thảo
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                                            {ver.updatedAt ? new Date(ver.updatedAt).toLocaleDateString('vi-VN') : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        loadRubricDetails(ver.id);
                                                        setActiveTab('rubric');
                                                    }}
                                                >
                                                    Xem / Sửa
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleOpenClone(ver)}
                                                >
                                                    Nhân bản
                                                </button>
                                                {!ver.isActive && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleActivate(ver.id)}
                                                    >
                                                        Kích hoạt
                                                    </button>
                                                )}
                                                {!ver.isActive && (
                                                    <Popconfirm
                                                        title="Bạn có chắc chắn muốn xóa bản ghi này?"
                                                        onConfirm={() => handleDelete(ver.id)}
                                                        okText="Xóa"
                                                        cancelText="Hủy"
                                                    >
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ color: 'var(--danger)' }}
                                                        >
                                                            Xóa
                                                        </button>
                                                    </Popconfirm>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PREVIEW FORM MODAL (A4 Layout) */}
            <Modal
                title={previewForm ? `${previewForm.code} · ${previewForm.title}` : 'Xem Biểu Mẫu'}
                open={Boolean(previewForm)}
                onCancel={() => setPreviewForm(null)}
                width={760}
                footer={[
                    <button key="close" className="btn btn-secondary" onClick={() => setPreviewForm(null)}>
                        Đóng
                    </button>,
                    <button
                        key="download"
                        className="btn btn-primary"
                        onClick={() => {
                            message.success(`Đang tải mẫu chuẩn: ${previewForm?.fileName}`);
                            setPreviewForm(null);
                        }}
                    >
                        Tải Mẫu Chuẩn (.docx)
                    </button>,
                ]}
            >
                {previewForm && (
                    <div style={{ padding: '16px 20px', background: '#F8FAFC', borderRadius: 8 }}>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                                TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT · VIỆN CÔNG NGHỆ SỐ
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--institutional)', marginTop: 8 }}>
                                {previewForm.code}: {previewForm.title.toUpperCase()}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                Khóa luận Tốt nghiệp Đại học · Áp dụng Phiên bản {previewForm.version} (2026)
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Mục đích & Phạm vi áp dụng:</div>
                            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{previewForm.sub}</p>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Cấu trúc các trường học vụ:</div>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                                {previewForm.fields.map((fld, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '10px 14px',
                                            borderBottom: idx < previewForm.fields.length - 1 ? '1px solid #F1F5F9' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{fld.name}</span>
                                        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                            {fld.type} {fld.required && <strong style={{ color: 'var(--danger)' }}>*</strong>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Quy chuẩn: {previewForm.period}</span>
                            <span>Thẩm quyền: {previewForm.reviewCouncil}</span>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CLONE MODAL */}
            <Modal
                title="Nhân bản Barem Rubric mới"
                open={cloneModalOpen}
                onCancel={() => setCloneModalOpen(false)}
                onOk={handleCloneSubmit}
                confirmLoading={cloning}
                okText="Nhân bản & Chỉnh sửa"
                cancelText="Hủy"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Mã phiên bản mới (ví dụ: v2.5, v3.0):
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            value={cloneVersionName}
                            onChange={(e) => setCloneVersionName(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Tên Barem mới:
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            value={cloneTitle}
                            onChange={(e) => setCloneTitle(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
