import { useState, useEffect } from 'react';
import { message, Upload, Button, Tooltip } from 'antd';
import { UploadOutlined, EyeOutlined } from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

function GradingCard({ registration, onRefresh }) {
    const [score, setScore] = useState(registration.finalScore ?? '');
    const [comment, setComment] = useState(registration.defenseResult?.comments || '');
    const [scoresheetUrl, setScoresheetUrl] = useState(registration.defenseResult?.scoresheetUrl || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setScore(registration.finalScore ?? '');
        setComment(registration.defenseResult?.comments || '');
        setScoresheetUrl(registration.defenseResult?.scoresheetUrl || '');
    }, [registration]);

    const handleSave = async () => {
        if (score === '' || score === null) {
            return message.warning('Vui lòng nhập điểm số hợp lệ.');
        }
        
        try {
            setSaving(true);
            const data = {
                registrationId: registration.id,
                finalScore: parseFloat(score),
                comments: comment,
                scoresheetUrl: scoresheetUrl
            };

            const res = await evaluationService.submitDefenseResult(data);
            if (res.success) {
                message.success('Đã xác nhận điểm bảo vệ thành công!');
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi lưu điểm bảo vệ');
        } finally {
            setSaving(false);
        }
    };

    // Placeholder mock for file upload
    const customUpload = async ({ file, onSuccess }) => {
        setTimeout(() => {
            setScoresheetUrl(URL.createObjectURL(file));
            onSuccess("ok");
            message.success(`${file.name} uploaded successfully.`);
        }, 1000);
    };

    const hasScore = score !== null && score !== undefined && score !== '';
    const student = registration.student;

    const statusColors = {
        'Chưa chấm': 'bg-amber-100 text-amber-700',
        'Đã chấm': 'bg-emerald-100 text-emerald-700',
    };

    const initials = (student?.fullName || 'S').split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();
    const scoreColor = score >= 8 ? 'text-emerald-600' : score >= 5 ? 'text-amber-600' : score !== '' ? 'text-red-600' : 'text-slate-400';

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                            Đề tài: {registration.topic?.title?.substring(0, 50)}...
                        </span>
                        {registration.council ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                                {registration.council.name}
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                GVHD
                            </span>
                        )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[registration.gradingStatus] || 'bg-slate-100 text-slate-600'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {registration.gradingStatus}
                    </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900">{registration.topic?.title}</h4>
            </div>

            {/* Student Grading */}
            <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Student Info */}
                    <div className="flex items-center gap-3 w-full lg:w-1/4 shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                            {initials}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{student?.fullName}</p>
                            <p className="text-xs text-slate-500 font-mono">{student?.code}</p>
                        </div>
                    </div>

                    {/* Score Input */}
                    <div className="relative w-full lg:w-32 shrink-0">
                        <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder="0.0"
                            className={`w-full h-14 rounded-lg border border-slate-200 bg-slate-50 text-2xl font-black ${scoreColor} text-center focus:ring-2 focus:ring-primary focus:border-primary transition-all`}
                        />
                        <div className="absolute right-3 top-4 text-slate-400 text-sm font-bold">/ 10</div>
                    </div>

                    {/* Comment Area */}
                    <div className="w-full lg:flex-1 space-y-3">
                        <textarea
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Nhập nhận xét về hội đồng bảo vệ, tiến độ thực hiện..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                        />
                        <div className="flex items-center gap-3">
                            <Upload customRequest={customUpload} showUploadList={false} accept="image/*,.pdf">
                                <Button icon={<UploadOutlined />}>Tải lên Bảng điểm</Button>
                            </Upload>
                            {scoresheetUrl && (
                                <Tooltip title="Xem bảng điểm">
                                    <Button type="link" icon={<EyeOutlined />} onClick={() => window.open(scoresheetUrl, '_blank')}>
                                        Xem ảnh
                                    </Button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
                <button
                    onClick={handleSave}
                    disabled={!hasScore || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasScore
                            ? 'bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5'
                            : 'bg-slate-200 text-slate-400'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Xác nhận Điểm Bảo Vệ
                </button>
            </div>
        </div>
    );
}

function GradingPage() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGradingStudents = async () => {
        try {
            setLoading(true);
            const res = await evaluationService.getGradingStudents();
            if (res.success) {
                setRegistrations(res.data);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách sinh viên chấm điểm');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGradingStudents();
    }, []);

    // Compute stats
    const totalStudents = registrations.length;
    const scoredStudents = registrations.filter(r => r.gradingStatus === 'Đã chấm').length;

    return (
        <div className="py-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 text-primary/70 text-sm font-medium mb-1">
                        <span>Học thuật</span>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span>Đánh giá Bảo vệ</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-primary tracking-tight">Chấm điểm Đồ án</h1>
                    <p className="text-slate-500 mt-1">Quản lý kết quả bảo vệ đồ án của sinh viên</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-bold hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined text-[18px]">filter_list</span>
                        Lọc
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Xuất bảng điểm
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-600">task_alt</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Đã chấm</p>
                        <p className="text-2xl font-bold text-slate-900">{scoredStudents} <span className="text-sm font-medium text-slate-400">/ {totalStudents}</span></p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600">group</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Tổng sinh viên</p>
                        <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-purple-600">assignment_ind</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Vai trò</p>
                        <p className="text-lg font-bold text-slate-900">Giám khảo / GVHD</p>
                    </div>
                </div>
            </div>

            {/* Grading Cards */}
            {loading ? (
                <div className="flex justify-center items-center min-h-[40vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                </div>
            ) : registrations.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">assignment_turned_in</span>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Chưa có sinh viên cần chấm điểm</h3>
                    <p className="text-slate-500">Chưa có sinh viên nào đủ điều kiện bảo vệ để chấm điểm.</p>
                </div>
            ) : (
                registrations.map((registration) => (
                    <GradingCard key={registration.id} registration={registration} onRefresh={fetchGradingStudents} />
                ))
            )}
        </div>
    );
}

export default GradingPage;