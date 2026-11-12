import { useState, useRef, useEffect } from 'react';
import { Button, Input, Tag, Spin, Tooltip } from 'antd';
import {
    MessageOutlined,
    CloseOutlined,
    SendOutlined,
    RobotOutlined,
    ClearOutlined,
    BookOutlined,
    QuestionCircleOutlined
} from '@ant-design/icons';
import aiService from '../../services/aiService';
import useAuth from '../../hooks/useAuth';

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

const INITIAL_MESSAGE = {
    id: 'welcome',
    sender: 'bot',
    text: 'Xin chào! Tôi là Trợ lý AI Quy chế Học vụ của Viện. Tôi có thể giải đáp các thắc mắc về đề cương BM01, đơn bảo vệ BM02, điều kiện dừng đề tài, hồ sơ lưu chiểu và các quy định đồ án tốt nghiệp.',
    provider: 'gemini-3.8-flash',
    relatedRegulations: [
        'Sổ tay Đồ án Tốt nghiệp',
        'Quy chế nộp lại v2 duy nhất (1 lần)'
    ],
    time: 'Bây giờ'
};

/**
 * AcademicChatWidget
 * Floating conversational assistant answering academic regulations,
 * thesis milestones, and institutional procedures with Gemini AI & Local Rule Fallback.
 * Strictly adheres to AGENTS.md Rule 2.6 (no raw emojis or symbols in Button labels).
 */
export default function AcademicChatWidget() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [quickQuestions, setQuickQuestions] = useState(() => getRoleQuickQuestions(user?.role));
    const messagesEndRef = useRef(null);

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
        }
    }, [messages, isOpen]);

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

        // Build multi-turn history context for backend adhering to Gemini format
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
                const botMsg = {
                    id: `bot-${Date.now()}`,
                    sender: 'bot',
                    text: res.data.reply || 'Không có phản hồi từ hệ thống.',
                    provider: res.data.provider || 'gemini-3.8-flash',
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
                text: error?.message || 'Hệ thống hiện không thể tra cứu. Vui lòng tham khảo Sổ tay Đồ án tốt nghiệp của Viện.',
                provider: 'local_fallback',
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
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
            {/* Chat Window Panel */}
            {isOpen && (
                <div className="w-[380px] h-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white px-4 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                                <RobotOutlined className="text-base" />
                            </div>
                            <div>
                                <div className="font-semibold text-sm leading-tight">
                                    Trợ Lý Quy Chế Học Vụ (AI)
                                </div>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                    {user?.role === 'LECTURER' ? (
                                        <Tag color="green">Giảng viên / HĐ</Tag>
                                    ) : user?.role === 'ADMIN' ? (
                                        <Tag color="purple">Quản trị viên</Tag>
                                    ) : (
                                        <Tag color="blue">Sinh viên</Tag>
                                    )}
                                    <Tag color="cyan" className="!text-[10px] !leading-4 !py-0 !px-1.5 !border-none !bg-white/20 !text-white font-medium">
                                        Gemini 3.8 Flash
                                    </Tag>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-1">
                            <Tooltip title="Làm mới cuộc trò chuyện">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ClearOutlined />}
                                    onClick={handleReset}
                                    className="!text-white hover:!bg-white/10 !px-2"
                                >
                                    Làm mới
                                </Button>
                            </Tooltip>
                            <Button
                                type="text"
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => setIsOpen(false)}
                                className="!text-white hover:!bg-white/10 !px-2"
                            >
                                Đóng
                            </Button>
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60 text-xs sm:text-sm">
                        {messages.map((msg) => {
                            const isUser = msg.sender === 'user';
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`rounded-2xl p-3 max-w-[85%] shadow-sm ${
                                            isUser
                                                ? 'bg-[#0F766E] text-white rounded-tr-none'
                                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                                        }`}
                                    >
                                        {!isUser && (
                                            <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-slate-100 text-[11px] text-slate-500 font-medium">
                                                <span className="flex items-center gap-1 text-[#0F766E]">
                                                    <RobotOutlined />
                                                    <span>Trợ lý Học vụ</span>
                                                </span>
                                                <Tag
                                                    className="!text-[9px] !leading-3 !px-1 !py-0 !m-0 !border-none"
                                                    color={msg.provider === 'local_fallback' ? 'orange' : 'cyan'}
                                                >
                                                    {msg.provider === 'local_fallback' ? 'Quy tắc nội bộ (Offline)' : 'Gemini 3.8 Flash'}
                                                </Tag>
                                            </div>
                                        )}

                                        <div className="whitespace-pre-line leading-relaxed">
                                            {msg.text}
                                        </div>

                                        {/* Related Regulations */}
                                        {!isUser && msg.relatedRegulations && msg.relatedRegulations.length > 0 && (
                                            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                                                <div className="text-slate-500 font-semibold mb-1 flex items-center gap-1">
                                                    <BookOutlined className="text-[#0F766E]" />
                                                    <span>Căn cứ quy chế liên quan:</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {msg.relatedRegulations.map((reg, idx) => (
                                                        <Tag
                                                            key={idx}
                                                            color="blue"
                                                            className="!text-[10px] !m-0 !px-1.5 !py-0.5 rounded"
                                                        >
                                                            {reg}
                                                        </Tag>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                        {msg.time}
                                    </span>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex flex-col items-start">
                                <div className="rounded-2xl rounded-tl-none p-3 max-w-[85%] bg-white text-slate-600 border border-slate-200/80 shadow-sm flex items-center space-x-2">
                                    <Spin size="small" />
                                    <span className="text-xs">Đang tra cứu quy chế học vụ...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Question Chips */}
                    {quickQuestions && quickQuestions.length > 0 && (
                        <div className="px-3 py-2 bg-slate-100/90 border-t border-slate-200/80">
                            <div className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                                Gợi ý câu hỏi nhanh:
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                {quickQuestions.map((question, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSend(question)}
                                        disabled={loading}
                                        className="text-[11px] bg-white hover:bg-teal-50 hover:text-[#0F766E] hover:border-[#0F766E] text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors shadow-2xs text-left flex items-center gap-1"
                                    >
                                        <QuestionCircleOutlined className="text-[#0F766E] text-[10px] shrink-0" />
                                        <span>{question}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Footer */}
                    <div className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
                        <Input
                            placeholder="Hỏi về quy chế, hạn nộp, BM01/BM02..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onPressEnter={() => handleSend(inputValue)}
                            disabled={loading}
                            className="rounded-lg text-xs sm:text-sm"
                            maxLength={500}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => handleSend(inputValue)}
                            loading={loading}
                            disabled={!inputValue.trim() || loading}
                            className="!bg-[#0F766E] hover:!bg-[#0D655E] !font-medium"
                        >
                            Gửi
                        </Button>
                    </div>
                </div>
            )}

            {/* Floating Trigger Toggle Button */}
            {!isOpen && (
                <Tooltip title="Trợ lý Quy chế Học vụ (AI)" placement="left">
                    <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={<MessageOutlined className="text-xl" />}
                        className="!w-14 !h-14 shadow-lg !bg-[#0F766E] hover:!bg-[#0D655E] flex items-center justify-center border-none transition-transform hover:scale-105"
                        onClick={() => setIsOpen(true)}
                    />
                </Tooltip>
            )}
        </div>
    );
}
