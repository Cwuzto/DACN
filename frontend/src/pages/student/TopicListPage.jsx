import { useState, useEffect, useCallback } from 'react';
import { message, Modal } from 'antd';
import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';

function TopicListPage() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'propose'
    const [savedIds, setSavedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('savedTopics')) || []; } catch { return []; }
    });

    // Modals
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [topicToRegister, setTopicToRegister] = useState(null);

    const [myRegistration, setMyRegistration] = useState(null);
    const [registering, setRegistering] = useState(false);
    // Form propose
    const [proposeForm, setProposeForm] = useState({ title: '', mentorId: '', description: '' });
    const [submittingPropose, setSubmittingPropose] = useState(false);

    // Dummy semesterId cho demo (nên lấy từ context hoặc API)
    const currentSemesterId = 1;

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { semesterId: currentSemesterId };
            if (searchText) params.search = searchText;

            const [topicRes, regRes] = await Promise.all([
                topicService.getAll(params),
                registrationService.getMyRegistration()
            ]);

            if (topicRes.success) {
                setTopics(topicRes.data.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
            }
            if (regRes.success) {
                setMyRegistration(regRes.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [searchText]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchInitialData();
    };

    const toggleSave = (id, e) => {
        if (e) e.stopPropagation();
        setSavedIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            localStorage.setItem('savedTopics', JSON.stringify(next));
            return next;
        });
    };

    const handleViewDetail = async (id) => {
        try {
            const res = await topicService.getById(id);
            setDetailTopic(res.data);
            setDetailModalOpen(true);
        } catch {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const confirmRegister = (topic) => {
        if (myRegistration && myRegistration.status !== 'REJECTED') {
            return message.warning('Bạn đã đăng ký đề tài rồi. Chỉ có thể đổi khi bị từ chối.');
        }

        setTopicToRegister(topic);
        setConfirmModalOpen(true);
    };

    const executeRegister = async () => {
        if (!topicToRegister) return;
        try {
            setRegistering(true);
            const res = await registrationService.registerTopic(topicToRegister.id, currentSemesterId);
            if (res.success) {
                message.success('Đăng ký đề tài thành công!');
                setConfirmModalOpen(false);
                fetchInitialData();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi đăng ký đề tài.');
        } finally {
            setRegistering(false);
        }
    };

    const handleProposeSubmit = async (e) => {
        e.preventDefault();
        if (!proposeForm.title || !proposeForm.mentorId || !proposeForm.description) {
            return message.warning('Vui lòng điền đầy đủ thông tin đề xuất.');
        }
        try {
            setSubmittingPropose(true);
            const res = await topicService.create({
                title: proposeForm.title,
                description: proposeForm.description,
                mentorId: proposeForm.mentorId,
                semesterId: currentSemesterId,
            });
            if (res.success) {
                message.success('Đã gửi đề xuất! Vui lòng chờ giảng viên duyệt.');
                setProposeForm({ title: '', mentorId: '', description: '' });
                setActiveTab('list');
                fetchInitialData();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi gửi đề xuất.');
        } finally {
            setSubmittingPropose(false);
        }
    };

    return (
        <div className="py-2">
            {/* Hero Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Đăng ký đề tài</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Chọn đề tài hoặc đề xuất ý tưởng của riêng bạn</p>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Tabs & Forms */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Tab Navigation */}
                    <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex w-full">
                        <button
                            className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'list' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('list')}
                        >
                            Chọn đề tài có sẵn
                        </button>
                        <button
                            className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'propose' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('propose')}
                        >
                            Đề xuất đề tài mới
                        </button>
                    </div>

                    {activeTab === 'list' && (
                        <>
                            {/* Search and Filter Bar */}
                            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        placeholder="Tìm kiếm đề tài, giảng viên..."
                                        type="text"
                                        value={searchText}
                                        onChange={e => setSearchText(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                                    Tìm kiếm
                                </button>
                            </form>

                            {/* Topics Grid */}
                            {loading ? (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
                                </div>
                            ) : topics.length === 0 ? (
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                                    <div className="size-16 bg-slate-100 rounded-full flex justify-center items-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-slate-400 text-3xl">search_off</span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">Không tìm thấy đề tài</h3>
                                    <p className="text-slate-500">Vui lòng thử nghiệm với từ khóa khác.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {topics.map(topic => {
                                        const registrationsCount = topic._count?.registrations || 0;
                                        const maxStudents = topic.maxStudents || 1;
                                        const isFull = registrationsCount >= maxStudents;
                                        const percent = maxStudents > 0 ? (registrationsCount / maxStudents) * 100 : 0;
                                        const isSaved = savedIds.includes(topic.id);
                                        const isMyTopic = myRegistration?.topicId === topic.id && myRegistration?.status !== 'REJECTED';

                                        return (
                                            <div key={topic.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow relative">
                                                <div className="flex justify-between items-start mb-3">
                                                    {isFull ? (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded">Đã đủ HV</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Còn chỗ</span>
                                                    )}
                                                    <span className="text-xs font-medium text-slate-500">Mã: DT-{String(topic.id).padStart(3, '0')}</span>
                                                </div>

                                                <h3
                                                    className="font-bold text-slate-900 dark:text-white leading-snug min-h-[3rem] cursor-pointer hover:text-primary transition-colors pr-8"
                                                    onClick={() => handleViewDetail(topic.id)}
                                                >
                                                    {topic.title}
                                                </h3>

                                                <button
                                                    onClick={(e) => toggleSave(topic.id, e)}
                                                    className="absolute top-12 right-4 p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <span className={`material-symbols-outlined text-[22px] ${isSaved ? 'text-red-500 fill-current' : ''}`}>
                                                        favorite
                                                    </span>
                                                </button>

                                                <div className="mt-4 flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined text-[18px]">account_circle</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold">{topic.mentor?.academicTitle === 'TIEN_SI' ? 'TS.' : topic.mentor?.academicTitle === 'PHO_GIAO_SU' ? 'PGS.' : 'ThS.'} {topic.mentor?.fullName || 'Chưa phân công'}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-5 space-y-2">
                                                    <div className="flex justify-between text-xs font-medium">
                                                        <span className="text-slate-600">Số lượng sinh viên</span>
                                                        <span className={isFull ? 'text-red-600' : 'text-primary'}>{registrationsCount}/{maxStudents} SV</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`${isFull ? 'bg-red-500' : 'bg-primary'} h-full rounded-full transition-all`} style={{ width: `${percent}%` }}></div>
                                                    </div>
                                                </div>

                                                {isMyTopic ? (
                                                    <button className="mt-6 w-full py-2.5 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-200 flex items-center justify-center gap-2 cursor-default">
                                                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                                        Đề tài đang chọn
                                                    </button>
                                                ) : isFull ? (
                                                    <button className="mt-6 w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold rounded-lg cursor-not-allowed">
                                                        Đã hết chỗ
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => confirmRegister(topic)}
                                                        className="mt-6 w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                                        disabled={myRegistration && myRegistration.status !== 'REJECTED'}
                                                    >
                                                        Đăng ký đề tài
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'propose' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold">Đề xuất đề tài mới</h2>
                                <p className="text-slate-500 mt-1 text-sm">Điền thông tin chi tiết về ý tưởng nghiên cứu bạn muốn thực hiện</p>
                            </div>
                            {myRegistration && myRegistration.status !== 'REJECTED' ? (
                                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg text-center font-medium">
                                    Bạn đã đăng ký một đề tài. Không thể đề xuất thêm.
                                </div>
                            ) : (
                                <form className="space-y-6" onSubmit={handleProposeSubmit}>
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Tên đề tài đề xuất</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Ví dụ: Nghiên cứu ứng dụng AR trong giáo dục..."
                                            type="text"
                                            value={proposeForm.title}
                                            onChange={e => setProposeForm({ ...proposeForm, title: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Giảng viên hướng dẫn mong muốn</label>
                                        <select
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary outline-none appearance-none"
                                            value={proposeForm.mentorId}
                                            onChange={e => setProposeForm({ ...proposeForm, mentorId: e.target.value })}
                                        >
                                            <option value="">Chọn giảng viên...</option>
                                            <option value="1">TS. Nguyễn Văn A</option>
                                            <option value="2">ThS. Lê Thị B</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-2">Mô tả chi tiết ý tưởng</label>
                                        <textarea
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Trình bày lý do, mục tiêu nghiên cứu và công nghệ sẽ áp dụng..."
                                            rows="5"
                                            value={proposeForm.description}
                                            onChange={e => setProposeForm({ ...proposeForm, description: e.target.value })}
                                        ></textarea>
                                    </div>
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                        <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                                            Lưu ý: Đề xuất này sẽ cần được Giảng viên xét duyệt. Nếu được duyệt, hệ thống sẽ tự động đăng ký đề tài này cho bạn.
                                        </p>
                                    </div>
                                    <div className="flex gap-4 pt-2">
                                        <button disabled={submittingPropose} className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all" type="submit">
                                            {submittingPropose ? 'Đang gửi...' : 'Gửi đề xuất'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Registration History & Info */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">app_registration</span>
                                <h2 className="text-lg font-bold">Trạng thái đăng ký</h2>
                            </div>
                        </div>
                        <div className="p-5">
                            {myRegistration ? (
                                <div className={`relative pl-4 border-l-2 ${myRegistration.status === 'APPROVED' ? 'border-emerald-500' : myRegistration.status === 'REJECTED' ? 'border-red-500' : 'border-amber-500'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                            {myRegistration.topic?.title || 'Chưa rõ tên đề tài'}
                                        </h4>
                                        <span className={`flex-shrink-0 ml-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            myRegistration.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                            myRegistration.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {myRegistration.status === 'PENDING' ? 'Chờ duyệt' : myRegistration.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">Giảng viên: {myRegistration.topic?.mentor?.fullName || '—'}</p>

                                    {myRegistration.status === 'REJECTED' && myRegistration.rejectReason && (
                                        <div className="mt-3 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 italic">
                                            Lý do: {myRegistration.rejectReason}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500">
                                    <div className="size-12 bg-slate-100 rounded-full flex justify-center items-center mx-auto mb-3">
                                        <span className="material-symbols-outlined text-slate-400">hourglass_empty</span>
                                    </div>
                                    <p className="text-sm">Bạn chưa đăng ký đề tài nào.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
                        <div className="size-10 rounded-lg bg-white/20 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined">info</span>
                        </div>
                        <h3 className="font-bold mb-2">Quy định đăng ký</h3>
                        <ul className="text-xs space-y-2 opacity-90 list-disc pl-4">
                            <li>Sinh viên thực hiện đề tài cá nhân.</li>
                            <li>Mỗi sinh viên chỉ được đăng ký tối đa 1 đề tài.</li>
                            <li>Nếu đề tài bị giảng viên từ chối, bạn có thể chọn đề tài khác.</li>
                            <li>Sinh viên có thể tự đề xuất ý tưởng nghiên cứu mới.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modal Detail */}
            {detailTopic && (
                <Modal
                    title={<span className="font-bold text-lg">Chi tiết đề tài</span>}
                    open={detailModalOpen}
                    onCancel={() => setDetailModalOpen(false)}
                    footer={null}
                    width={650}
                    className="tailwind-modal"
                >
                    <div className="mt-4 space-y-4">
                        <h3 className="text-xl font-bold text-primary">{detailTopic.title}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-line">
                            {detailTopic.description || 'Không có mô tả chi tiết cho đề tài này.'}
                        </p>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Giảng viên hướng dẫn</p>
                                <p className="font-bold text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                                    {detailTopic.mentor?.fullName || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Mã đề tài</p>
                                <p className="font-bold text-sm">DT-{String(detailTopic.id).padStart(3, '0')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase mb-1">SV tối đa</p>
                                <p className="font-bold text-sm">{detailTopic.maxStudents} Sinh viên</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Đã đăng ký</p>
                                <p className="font-bold text-sm text-primary">{detailTopic.registrations?.length || 0} Sinh viên</p>
                            </div>
                        </div>

                        {detailTopic.registrations?.length > 0 && (
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-500 font-medium uppercase mb-3">Sinh viên đã tham gia</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {detailTopic.registrations.map(reg => (
                                        <div key={reg.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                                            <span className="font-semibold text-sm">{reg.student?.fullName}</span>
                                            <span className="text-xs font-bold text-slate-500">{reg.student?.code}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Confirm Registration Modal */}
            <Modal
                title={<span className="font-bold flex items-center gap-2"><span className="material-symbols-outlined text-primary">app_registration</span> Xác nhận đăng ký</span>}
                open={confirmModalOpen}
                onCancel={() => setConfirmModalOpen(false)}
                footer={null}
                width={500}
            >
                <div className="py-4">
                    <p className="text-slate-600 mb-4">Bạn có chắc chắn muốn đăng ký đề tài này?</p>
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 mb-6">
                        <p className="font-bold text-primary mb-1">{topicToRegister?.title}</p>
                        <p className="text-sm text-slate-600 flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">person</span> GVHD: {topicToRegister?.mentor?.fullName}</p>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button
                            className="px-5 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            onClick={() => setConfirmModalOpen(false)}
                            disabled={registering}
                        >
                            Hủy bỏ
                        </button>
                        <button
                            className="px-5 py-2 rounded-lg font-semibold bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
                            onClick={executeRegister}
                            disabled={registering}
                        >
                            {registering ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : null}
                            Xác nhận đăng ký
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default TopicListPage;
