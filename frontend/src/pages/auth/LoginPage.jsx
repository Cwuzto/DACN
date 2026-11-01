import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LoginPage fallback: Chuyển hướng người dùng về trang chủ với popup đăng nhập
 */
export default function LoginPage() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/?login=true', { replace: true });
    }, [navigate]);

    return null;
}
