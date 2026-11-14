import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

function PasswordStrengthMeter({ password = '' }) {
    const analysis = useMemo(() => {
        if (!password) {
            return {
                score: 0,
                label: 'Chưa nhập',
                color: '#94a3b8',
                checks: {
                    length: false,
                    lettersAndNumbers: false,
                    complex: false,
                },
            };
        }

        const hasLength = password.length >= 6;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialOrUpper = /[^a-zA-Z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password));

        const checks = {
            length: hasLength,
            lettersAndNumbers: hasLetter && hasNumber,
            complex: password.length >= 8 && hasSpecialOrUpper,
        };

        let passedCount = 0;
        if (checks.length) passedCount += 1;
        if (checks.lettersAndNumbers) passedCount += 1;
        if (checks.complex) passedCount += 1;

        if (!hasLength) {
            return {
                score: 25,
                label: 'Yếu',
                color: '#ef4444',
                checks,
            };
        }

        if (passedCount === 1) {
            return {
                score: 40,
                label: 'Yếu',
                color: '#ef4444',
                checks,
            };
        }

        if (passedCount === 2) {
            return {
                score: 70,
                label: 'Trung bình',
                color: '#f59e0b',
                checks,
            };
        }

        return {
            score: 100,
            label: 'Mạnh',
            color: '#10b981',
            checks,
        };
    }, [password]);

    if (!password) {
        return null;
    }

    return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600">Độ mạnh mật khẩu:</span>
                <span className="text-xs font-bold" style={{ color: analysis.color }}>
                    {analysis.label}
                </span>
            </div>
            <Progress
                percent={analysis.score}
                strokeColor={analysis.color}
                showInfo={false}
                size="small"
                className="mb-2"
            />
            <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    {analysis.checks.length ? (
                        <CheckCircleFilled className="text-emerald-500 text-xs" />
                    ) : (
                        <CloseCircleFilled className="text-slate-300 text-xs" />
                    )}
                    <span className={analysis.checks.length ? 'text-slate-700 font-medium' : ''}>
                        Tối thiểu 6 ký tự
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {analysis.checks.lettersAndNumbers ? (
                        <CheckCircleFilled className="text-emerald-500 text-xs" />
                    ) : (
                        <CloseCircleFilled className="text-slate-300 text-xs" />
                    )}
                    <span className={analysis.checks.lettersAndNumbers ? 'text-slate-700 font-medium' : ''}>
                        Kết hợp cả chữ cái và chữ số
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {analysis.checks.complex ? (
                        <CheckCircleFilled className="text-emerald-500 text-xs" />
                    ) : (
                        <CloseCircleFilled className="text-slate-300 text-xs" />
                    )}
                    <span className={analysis.checks.complex ? 'text-slate-700 font-medium' : ''}>
                        Tối thiểu 8 ký tự kèm ký tự đặc biệt hoặc chữ hoa
                    </span>
                </div>
            </div>
        </div>
    );
}

PasswordStrengthMeter.propTypes = {
    password: PropTypes.string,
};

export default PasswordStrengthMeter;
