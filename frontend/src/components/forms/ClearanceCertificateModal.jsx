import React, { useRef } from 'react';
import {
    Modal,
    Button,
    Flex,
    Tag,
    Typography,
    Divider,
    Space,
} from 'antd';
import {
    PrinterOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    DownloadOutlined,
    QrcodeOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

export default function ClearanceCertificateModal({
    visible,
    onClose,
    certificateData,
}) {
    const printRef = useRef(null);

    if (!certificateData) return null;

    const {
        certificateNumber,
        issueDate,
        student = {},
        topic = {},
        mentor = {},
        council = {},
        evaluation = {},
        archive = {},
    } = certificateData;

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            width={780}
            title={(
                <Flex align="center" gap={8}>
                    <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
                    <span className="font-bold text-slate-800">Giấy Xác Nhận Hoàn Thành Đồ Án Tốt Nghiệp</span>
                </Flex>
            )}
            footer={(
                <Flex justify="space-between" align="center">
                    <span className="text-xs text-slate-400">
                        Mã xác thực: <b>{certificateNumber}</b>
                    </span>
                    <Space>
                        <Button onClick={onClose}>Đóng</Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-500 font-medium"
                        >
                            In Giấy Xác Nhận
                        </Button>
                    </Space>
                </Flex>
            )}
            destroyOnClose
        >
            {/* Printable Paper Canvas */}
            <div
                ref={printRef}
                className="p-8 my-2 bg-white rounded-xl border border-slate-300/80 shadow-sm print:p-0 print:border-none print:shadow-none text-slate-800"
                style={{ fontFamily: 'Times New Roman, serif' }}
            >
                {/* Header TDMU */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div className="text-center w-5/12">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700">ỦY BAN NHÂN DÂN TỈNH BÌNH DƯƠNG</div>
                        <div className="text-sm font-black uppercase text-blue-900 mt-0.5">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</div>
                        <div className="text-[11px] font-semibold text-slate-600 mt-0.5">KHOA CÔNG NGHỆ THÔNG TIN</div>
                    </div>
                    <div className="text-center w-6/12">
                        <div className="text-xs font-bold uppercase text-slate-800">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="text-xs font-bold text-slate-800 underline mt-0.5">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="text-[11px] italic text-slate-500 mt-2">
                            Bình Dương, ngày {new Date(issueDate).getDate()} tháng {new Date(issueDate).getMonth() + 1} năm {new Date(issueDate).getFullYear()}
                        </div>
                    </div>
                </div>

                {/* Certificate Title */}
                <div className="text-center my-6 space-y-1">
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide text-blue-950">
                        GIẤY XÁC NHẬN HOÀN THÀNH ĐỒ ÁN
                    </h2>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        (CLEARANCE CERTIFICATE & ARCHIVE CONFIRMATION)
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-1">
                        Số: <b>{certificateNumber}</b> / XN-ĐATH
                    </div>
                </div>

                {/* Body Content */}
                <div className="space-y-4 text-sm leading-relaxed text-slate-800">
                    <p className="text-justify indent-6">
                        Khoa Công nghệ Thông tin – Trường Đại học Thủ Dầu Một chứng nhận sinh viên có tên sau đây đã hoàn tất toàn bộ quy trình thực hiện, bảo vệ và nộp hồ sơ lưu chiểu đồ án tốt nghiệp theo đúng quy chế đào tạo đại học hiện hành:
                    </p>

                    <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>Họ và tên sinh viên: <b className="text-sm text-slate-900">{student.fullName}</b></div>
                            <div>Mã số sinh viên: <b className="text-sm text-blue-900">{student.code}</b></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>Đơn vị / Khoa: <b>{student.department || 'Khoa Công Nghệ Thông Tin'}</b></div>
                            <div>Học phần: <b>{topic.courseName || 'Khóa luận tốt nghiệp'}</b> ({topic.academicYear || '2025 - 2026'})</div>
                        </div>
                        <div>
                            Tên đề tài: <b className="text-slate-950">{topic.title}</b>
                        </div>
                        <div>
                            Giảng viên hướng dẫn: <b>{mentor.fullName}</b> {mentor.academicTitle ? `(${mentor.academicTitle})` : ''}
                        </div>
                    </div>

                    {/* Defense & Evaluation Results */}
                    <div className="border border-emerald-200 bg-emerald-50/40 p-4 rounded-lg text-xs space-y-2">
                        <div className="font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                            <CheckCircleOutlined className="text-emerald-600" />
                            KẾT QUẢ BẢO VỆ TRƯỚC HỘI ĐỒNG & NGHIỆM THU LƯU CHIỂU
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div>
                                <span className="text-slate-500">Hội đồng chấm:</span>
                                <div className="font-semibold text-slate-800">{council.name || 'Hội đồng chuyên môn'}</div>
                            </div>
                            <div>
                                <span className="text-slate-500">Điểm tổng kết:</span>
                                <div className="font-black text-base text-emerald-700">
                                    {evaluation.finalScore ? Number(evaluation.finalScore).toFixed(2) : '--'} / 10
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-500">Xếp loại học vụ:</span>
                                <div className="font-bold text-blue-800">
                                    Thang điểm chữ {evaluation.letterGrade} ({evaluation.rankingText})
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-justify indent-6 text-xs text-slate-600 italic">
                        * Sinh viên đã hoàn thiện báo cáo toàn văn theo biên bản góp ý của Hội đồng, nộp đầy đủ bản thuyết minh, slide trình chiếu, video demo và mã nguồn vào Kho Lưu Chiểu số của Trường Đại học Thủ Dầu Một. Hồ sơ được nghiệm thu chính thức và không còn vướng mắc học vụ.
                    </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 mt-8 pt-6 text-center text-xs">
                    <div>
                        <div className="font-bold uppercase text-slate-800">GIẢNG VIÊN HƯỚNG DẪN</div>
                        <div className="text-[11px] text-slate-400 italic mb-14">(Ký và ghi rõ họ tên)</div>
                        <div className="font-bold text-slate-900 text-sm">{archive.reviewerName || mentor.fullName}</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase text-slate-800">TRƯỞNG KHOA / BAN QUẢN TRỊ</div>
                        <div className="text-[11px] text-slate-400 italic mb-14">(Xác nhận điện tử qua hệ thống)</div>
                        <div className="inline-block px-3 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                            ✓ ĐÃ NGHIỆM THU ĐIỆN TỬ
                        </div>
                    </div>
                </div>

                {/* Footer verification note */}
                <div className="mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                        <QrcodeOutlined />
                        <span>Hệ thống Quản lý Đồ án Tốt nghiệp TDMU • Xác thực điện tử</span>
                    </div>
                    <div>Thời điểm nghiệm thu: {new Date(issueDate).toLocaleString('vi-VN')}</div>
                </div>
            </div>
        </Modal>
    );
}
