import { useState, useRef, useEffect } from 'react';
import { Button, Input, Tag, Tooltip, message as antdMessage } from 'antd';
import {
    MessageOutlined,
    CloseOutlined,
    SendOutlined,
    RobotOutlined,
    ClearOutlined,
    BookOutlined,
    QuestionCircleOutlined,
    CopyOutlined,
    CheckOutlined,
    ArrowsAltOutlined,
    ShrinkOutlined,
    BulbOutlined,
    UserOutlined,
    UpOutlined,
    DownOutlined
} from '@ant-design/icons';
import aiService from '../../services/aiService';
import useAuth from '../../hooks/useAuth';

export const BOT_NAME = 'Trợ lý Học vụ VCN';

export const ROLE_QUICK_QUESTIONS = {
    STUDENT: [
        'Hạn nộp BM01 khi nào?',
        'Điều kiện để được ra bảo vệ đồ án?',
        'Khi nào bị dừng đề tài?',
        'Quy định đổi tên đề tài?'
    ],
    LECTURER: [
        'Tiêu chí chấm 4 nhóm chuẩn đầu ra BM04?',
        'Quy trình thẩm định dừng đề tài BM03?',
        'Cơ cấu điểm Hội đồng bảo vệ?',
        'Gợi ý câu hỏi phản biện kỹ thuật'
    ],
    ADMIN: [
        'Quy trình ban hành quyết định giao đề tài?',
        'Xử lý quá hạn SLA 168 giờ thế nào?',
        'Cơ chế hoạt động của 5 Sweep Jobs?'
    ]
};

export const getRoleQuickQuestions = (role) => {
    if (role === 'LECTURER') return ROLE_QUICK_QUESTIONS.LECTURER;
    if (role === 'ADMIN') return ROLE_QUICK_QUESTIONS.ADMIN;
    return ROLE_QUICK_QUESTIONS.STUDENT;
};

export const renderRoleBadge = (role) => {
    switch (role) {
        case 'LECTURER':
            return <Tag color="green">Giảng viên / HĐ</Tag>;
        case 'ADMIN':
            return <Tag color="purple">Quản trị viên</Tag>;
        case 'STUDENT':
        default:
            return <Tag color="blue">Sinh viên</Tag>;
    }
};

const DB_STATUS_TRANSLATIONS = [
    { pattern: /\bPASSED\b/g, replacement: 'hoàn tất' },
    { pattern: /\bFAILED\b/g, replacement: 'chưa đạt' },
    { pattern: /\bIN_PROGRESS\b/g, replacement: 'đang diễn ra' },
    { pattern: /\bONGOING\b/g, replacement: 'đang diễn ra' },
    { pattern: /\bDEFENSE_READY\b/g, replacement: 'sẵn sàng bảo vệ' },
    { pattern: /\bREADY_FOR_DEFENSE\b/g, replacement: 'sẵn sàng bảo vệ' },
    { pattern: /\bDEFENSE_PASSED\b/g, replacement: 'bảo vệ đạt' },
    { pattern: /\bDEFENSE_FAILED\b/g, replacement: 'bảo vệ không đạt' },
    { pattern: /\bAWAITING_SCORES\b/g, replacement: 'chờ đủ phiếu chấm' },
    { pattern: /\bAWAITING_FINAL_APPROVAL\b/g, replacement: 'chờ phê duyệt kết quả' },
    { pattern: /\bBM01_PASSED\b/g, replacement: 'đề cương đạt' },
    { pattern: /\bBM01_SUBMITTED\b/g, replacement: 'chờ duyệt đề cương' },
    { pattern: /\bBM01_NEEDS_REVISION\b/g, replacement: 'đề cương cần chỉnh sửa' },
    { pattern: /\bBM02_SUBMITTED\b/g, replacement: 'chờ duyệt nhiệm vụ' },
    { pattern: /\bBM03_PASSED\b/g, replacement: 'đạt đánh giá tiến độ' },
    { pattern: /\bBM04_REVIEW\b/g, replacement: 'đang thẩm định phiếu nhận xét' },
    { pattern: /\bDECISION_ISSUED\b/g, replacement: 'đã ban hành quyết định giao đề tài' },
    { pattern: /\bREGISTERED\b/g, replacement: 'đã đăng ký đề tài' },
    { pattern: /\bCOMPLETED\b/g, replacement: 'hoàn tất' },
    { pattern: /\bAPPROVED\b/g, replacement: 'đã duyệt' },
    { pattern: /\bREJECTED\b/g, replacement: 'bị từ chối' },
    { pattern: /\bPENDING\b/g, replacement: 'đang chờ duyệt' },
    { pattern: /\bSUBMITTED\b/g, replacement: 'đã nộp' },
    { pattern: /\bDROPPED\b/g, replacement: 'đã dừng đề tài' },
];

export function sanitizeChatbotResponse(rawText = '') {
    if (typeof rawText !== 'string') return '';
    let cleaned = rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<user_query>[\s\S]*?<\/user_query>/gi, '')
        .replace(/&lt;user_query&gt;[\s\S]*?&lt;\/user_query&gt;/gi, '')
        .replace(/<\/?user_query>/gi, '')
        .replace(/&lt;\/?user_query&gt;/gi, '');

    DB_STATUS_TRANSLATIONS.forEach(({ pattern, replacement }) => {
        cleaned = cleaned.replace(pattern, replacement);
    });

    cleaned = cleaned.replace(/^[ \t]*\*[ \t]+/gm, '- ');
    cleaned = cleaned.replace(/\*/g, '');

    return cleaned.trim();
}

const INITIAL_MESSAGE = {
    id: 'welcome',
    sender: 'bot',
    text: 'Xin chào! Tôi là Trợ lý Học vụ của Viện Công nghệ Số.\n\nTôi sẵn sàng giải đáp và hướng dẫn chi tiết về các quy định thực hiện đồ án tốt nghiệp:\n• Đề cương BM01 & Hội đồng xét duyệt đề cương\n• Đơn đăng ký BM02 & Cửa sổ 168h xin đổi tên đề tài (BM02-A)\n• Tiến độ thực hiện BM03 & 2 Checkpoint bắt buộc\n• Đánh giá trước bảo vệ BM04 & Tiêu chí xét bảo vệ\n• Quy chế bảo vệ trước Hội đồng & Nộp hồ sơ lưu chiểu',
    provider: 'academic_assistant',
    relatedRegulations: [
        'Sổ tay Đồ án Tốt nghiệp',
        'Quy chế nộp lại v2 duy nhất (1 lần)'
    ],
    time: 'Bây giờ'
};

/**
 * AcademicChatWidget (UI/UX Pro Max Edition)
 * Floating conversational assistant answering academic regulations,
 * thesis milestones, and institutional procedures for Viện Công nghệ Số.
 *
 * Design features:
 * - Clean academic identity ("Trợ lý Học vụ VCN") with zero technical model jargon
 * - Glassmorphic floating window with dual-mode sizing (Standard & Expanded reading mode)
 * - Online beacon pulse indicator (Active 24/7)
 * - Role-based dynamic context & collapsible quick question drawer
 * - One-click answer copy to clipboard with instant feedback
 * - Multi-turn conversational memory with smooth auto-scroll
 * - Strictly adheres to AGENTS.md Rule 2.6 (no raw emojis or symbols in Button labels)
 */
export default function AcademicChatWidget() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isQuestionsCollapsed, setIsQuestionsCollapsed] = useState(false);
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [quickQuestions, setQuickQuestions] = useState(() => getRoleQuickQuestions(user?.role));
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Synchronize quick questions whenever user role changes
    useEffect(() => {
        setQuickQuestions(getRoleQuickQuestions(user?.role));
    }, [user?.role]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            // Autofocus input on open
            setTimeout(() => {
                inputRef.current?.focus();
            }, 150);
        }
    }, [messages, isOpen, isExpanded]);

    const handleCopy = async (id, text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            antdMessage.success('Đã sao chép nội dung giải đáp vào bộ nhớ tạm!');
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            antdMessage.error('Không thể sao chép');
        }
    };

    const handleSend = async (questionText) => {
        const query = (typeof questionText === 'string' ? questionText : inputValue).trim();
        if (!query || loading) return;

        const userMsg = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: query,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputValue('');
        setLoading(true);

        // Build multi-turn history context for backend
        const history = messages
            .filter((m) => m.id !== 'welcome' && !m.id?.startsWith('bot-err'))
            .map((m) => ({
                role: m.sender === 'user' ? 'user' : 'model',
                text: m.text,
                content: m.text
            }));

        try {
            const res = await aiService.chatRegulation({
                message: query,
                history
            });

            if (res?.success && res.data) {
                const rawReply = String(res.data.reply || '');
                const cleanReply = sanitizeChatbotResponse(rawReply);

                const botMsg = {
                    id: `bot-${Date.now()}`,
                    sender: 'bot',
                    text: cleanReply || 'Không có phản hồi từ hệ thống.',
                    provider: 'academic_assistant',
                    relatedRegulations: res.data.relatedRegulations || [],
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setMessages((prev) => [...prev, botMsg]);

                if (Array.isArray(res.data.suggestedQuickQuestions) && res.data.suggestedQuickQuestions.length > 0) {
                    setQuickQuestions(res.data.suggestedQuickQuestions);
                }
            } else {
                throw new Error(res?.message || 'Lỗi xử lý phản hồi');
            }
        } catch (error) {
            const errorMsg = {
                id: `bot-err-${Date.now()}`,
                sender: 'bot',
                text: error?.message || 'Trợ lý hiện chưa thể tra cứu thông tin này. Vui lòng tham khảo Sổ tay Đồ án tốt nghiệp của Viện hoặc liên hệ Giáo vụ.',
                provider: 'academic_assistant',
                relatedRegulations: ['Sổ tay Đồ án Tốt nghiệp'],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setMessages([INITIAL_MESSAGE]);
        setQuickQuestions(getRoleQuickQuestions(user?.role));
        antdMessage.info('Đã làm mới phiên tư vấn');
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto font-sans">
            {/* Chat Window Panel */}
            {isOpen && (
                <div
                    className={`${
                        isExpanded
                            ? 'w-[640px] h-[720px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)]'
                            : 'w-[410px] h-[580px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)]'
                    } bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden mb-3.5 transition-all duration-300 ease-out ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-4`}
                    style={{
                        boxShadow: '0 20px 45px -10px rgba(15, 118, 110, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)'
                    }}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 text-white px-3.5 py-3 flex items-center justify-between border-b border-teal-600/30 shadow-sm relative overflow-hidden gap-2">
                        {/* Decorative background aura */}
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                        {/* Left Identity Section: Avatar + Title + Badges */}
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1 z-10">
                            <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-white/20 to-white/10 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center text-white shadow-inner">
                                    <RobotOutlined className="text-base" />
                                </div>
                                {/* Online beacon */}
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 border border-teal-900" />
                                </span>
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs sm:text-sm leading-tight tracking-wide text-white truncate flex items-center gap-1.5">
                                    <span>{BOT_NAME}</span>
                                </div>

                                <div className="flex items-center gap-1 mt-1 flex-nowrap overflow-hidden">
                                    {user?.role === 'LECTURER' ? (
                                        <Tag color="green">Giảng viên / HĐ</Tag>
                                    ) : user?.role === 'ADMIN' ? (
                                        <Tag color="purple">Quản trị viên</Tag>
                                    ) : (
                                        <Tag color="blue">Sinh viên</Tag>
                                    )}

                                    <Tag
                                        color="cyan"
                                        className="!text-[10px] !leading-3.5 !py-0 !px-1.5 !border-none !bg-white/15 !text-teal-100 font-medium tracking-tight rounded-sm shrink-0"
                                    >
                                        Trực tuyến 24/7
                                    </Tag>
                                </div>
                            </div>
                        </div>

                        {/* Top Action Buttons (Icon-only with Tooltips & aria-label, completely overflow-proof) */}
                        <div className="flex items-center space-x-1 shrink-0 z-10">
                            <Tooltip title={isExpanded ? 'Thu nhỏ giao diện' : 'Mở rộng giao diện'}>
                                <Button
                                    type="text"
                                    size="small"
                                    shape="circle"
                                    aria-label={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                                    icon={isExpanded ? <ShrinkOutlined className="text-sm" /> : <ArrowsAltOutlined className="text-sm" />}
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="!w-7 !h-7 !text-teal-100 hover:!text-white hover:!bg-white/20 flex items-center justify-center !border-none"
                                />
                            </Tooltip>

                            <Tooltip title="Làm mới phiên hội thoại">
                                <Button
                                    type="text"
                                    size="small"
                                    shape="circle"
                                    aria-label="Làm mới"
                                    icon={<ClearOutlined className="text-sm" />}
                                    onClick={handleReset}
                                    className="!w-7 !h-7 !text-teal-100 hover:!text-white hover:!bg-white/20 flex items-center justify-center !border-none"
                                />
                            </Tooltip>

                            <Tooltip title="Đóng cửa sổ">
                                <Button
                                    type="text"
                                    size="small"
                                    shape="circle"
                                    aria-label="Đóng"
                                    icon={<CloseOutlined className="text-sm" />}
                                    onClick={() => setIsOpen(false)}
                                    className="!w-7 !h-7 !text-teal-100 hover:!text-white hover:!bg-white/20 flex items-center justify-center !border-none"
                                />
                            </Tooltip>
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-slate-50/70 to-slate-100/50 text-xs sm:text-sm">
                        {messages.map((msg) => {
                            const isUser = msg.sender === 'user';
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
                                >
                                    <div
                                        className={`rounded-2xl p-3.5 shadow-xs transition-shadow relative ${
                                            isUser
                                                ? 'bg-gradient-to-r from-teal-700 to-teal-800 text-white rounded-tr-xs max-w-[85%] shadow-teal-900/10'
                                                : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs max-w-[90%] shadow-slate-200/50'
                                        }`}
                                    >
                                        {!isUser && (
                                            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 text-[11px] text-slate-500 font-medium">
                                                <span className="flex items-center gap-1.5 text-teal-700 font-semibold">
                                                    <RobotOutlined className="text-sm" />
                                                    <span>Trợ lý Học vụ</span>
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <Tag
                                                        className="!text-[9px] !leading-3 !px-1.5 !py-0.5 !m-0 !border-none font-medium"
                                                        color="cyan"
                                                    >
                                                        Phản hồi học vụ
                                                    </Tag>
                                                    {/* Quick copy response button */}
                                                    <Tooltip title="Sao chép nội dung">
                                                        <button
                                                            type="button"
                                                            aria-label="Sao chép phản hồi"
                                                            onClick={() => handleCopy(msg.id, msg.text)}
                                                            className="text-slate-400 hover:text-teal-700 p-0.5 rounded transition-colors cursor-pointer"
                                                        >
                                                            {copiedId === msg.id ? (
                                                                <CheckOutlined className="text-emerald-600 text-xs" />
                                                            ) : (
                                                                <CopyOutlined className="text-xs" />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        )}

                                        <div className="whitespace-pre-line leading-relaxed text-slate-700 font-normal">
                                            {isUser ? <span className="text-white font-normal">{msg.text}</span> : msg.text}
                                        </div>

                                        {/* Related Regulations Badge Pill */}
                                        {!isUser && msg.relatedRegulations && msg.relatedRegulations.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-slate-100/90 text-[11px]">
                                                <div className="text-slate-500 font-medium mb-1.5 flex items-center gap-1.5">
                                                    <BookOutlined className="text-teal-700" />
                                                    <span>Căn cứ quy chế liên quan:</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.relatedRegulations.map((reg, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-50/80 text-teal-800 border border-teal-200/70"
                                                        >
                                                            <BookOutlined className="text-[9px]" />
                                                            {reg}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <span className="text-[10px] text-slate-400 mt-1 px-1.5 flex items-center gap-1">
                                        {isUser ? <UserOutlined className="text-[9px]" /> : <RobotOutlined className="text-[9px]" />}
                                        {msg.time}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Modern Typing / Thinking Indicator */}
                        {loading && (
                            <div className="flex flex-col items-start animate-in fade-in duration-200">
                                <div className="rounded-2xl rounded-tl-xs p-3.5 max-w-[85%] bg-white text-slate-600 border border-slate-200/90 shadow-sm flex items-center space-x-3">
                                    <div className="flex space-x-1">
                                        <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">Trợ lý đang tra cứu quy chế học vụ...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Question Chips Carousel (Collapsible) */}
                    {quickQuestions && quickQuestions.length > 0 && (
                        <div className="bg-slate-100/95 border-t border-slate-200/80 transition-all duration-200">
                            {/* Collapsible Header Bar */}
                            <div
                                onClick={() => setIsQuestionsCollapsed(!isQuestionsCollapsed)}
                                className="px-3.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-200/60 select-none transition-colors"
                            >
                                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <BulbOutlined className="text-amber-500" />
                                    <span>Gợi ý câu hỏi ({quickQuestions.length})</span>
                                </div>
                                <Button
                                    type="text"
                                    size="small"
                                    className="!text-[11px] !text-slate-500 hover:!text-teal-700 !p-0 !h-5 flex items-center gap-1"
                                    icon={isQuestionsCollapsed ? <DownOutlined className="text-[10px]" /> : <UpOutlined className="text-[10px]" />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsQuestionsCollapsed(!isQuestionsCollapsed);
                                    }}
                                >
                                    {isQuestionsCollapsed ? 'Mở rộng' : 'Thu gọn'}
                                </Button>
                            </div>

                            {/* Expandable Question Chips */}
                            {!isQuestionsCollapsed && (
                                <div className="px-3.5 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 animate-in fade-in duration-200">
                                    {quickQuestions.map((question, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleSend(question)}
                                            disabled={loading}
                                            className="text-[11px] bg-white hover:bg-teal-50/90 hover:text-teal-800 hover:border-teal-400 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200/90 transition-all shadow-2xs text-left flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                                        >
                                            <QuestionCircleOutlined className="text-teal-600 text-[10px] shrink-0" />
                                            <span>{question}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Input Footer */}
                    <div className="p-3 bg-white border-t border-slate-200/90 flex flex-col gap-1.5">
                        <div className="flex gap-2 items-center">
                            <Input
                                ref={inputRef}
                                placeholder="Hỏi về quy chế, hạn nộp, BM01, BM04..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onPressEnter={() => handleSend(inputValue)}
                                disabled={loading}
                                className="rounded-xl text-xs sm:text-sm !py-2 !px-3 border-slate-200 focus:!border-teal-600 focus:!ring-1 focus:!ring-teal-600/20"
                                maxLength={500}
                            />
                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={() => handleSend(inputValue)}
                                loading={loading}
                                disabled={!inputValue.trim() || loading}
                                className="!bg-teal-700 hover:!bg-teal-800 !font-medium !h-9 !px-4 !rounded-xl !shadow-sm flex items-center justify-center transition-all shrink-0"
                            >
                                Gửi
                            </Button>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                            <span>Nhấn Enter để gửi</span>
                            <span>{inputValue.length}/500</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Trigger Toggle Button */}
            {!isOpen && (
                <div className="relative group">
                    {/* Floating mini status badge */}
                    <div className="absolute -top-10 right-0 hidden group-hover:flex items-center px-2.5 py-1 bg-slate-900/90 backdrop-blur-sm text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200">
                        <span>Hỏi đáp Quy chế Học vụ (24/7)</span>
                    </div>

                    <Tooltip title={BOT_NAME} placement="left">
                        <Button
                            type="primary"
                            shape="circle"
                            size="large"
                            icon={<MessageOutlined className="text-xl" />}
                            className="!w-14 !h-14 shadow-xl !bg-gradient-to-tr !from-teal-800 !to-teal-600 hover:!from-teal-700 hover:!to-teal-500 flex items-center justify-center border-none transition-all duration-200 hover:scale-105 active:scale-95"
                            style={{
                                boxShadow: '0 10px 25px -5px rgba(15, 118, 110, 0.4)'
                            }}
                            onClick={() => setIsOpen(true)}
                        />
                    </Tooltip>

                    {/* Online indicator beacon on button */}
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 pointer-events-none">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                    </span>
                </div>
            )}
        </div>
    );
}
