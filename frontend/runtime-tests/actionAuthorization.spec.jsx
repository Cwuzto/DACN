import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import useAuthStore from '../src/stores/authStore.js';
import AuthorizedAction from '../src/components/common/AuthorizedAction.jsx';
import { Button } from 'antd';

beforeEach(() => {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        token: null,
    });
});

test('AuthorizedAction with mode="hide" hides mutation button when user lacks action capability', () => {
    // User only has VIEW_USERS, lacks USER_MANAGE
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 1,
            role: 'ADMIN',
            permissions: ['VIEW_USERS'],
        },
    });

    render(
        <AuthorizedAction feature="users" action="create" mode="hide">
            <Button data-testid="create-user-btn">Thêm Người Dùng</Button>
        </AuthorizedAction>
    );

    expect(screen.queryByTestId('create-user-btn')).toBeNull();
});

test('AuthorizedAction with mode="hide" renders mutation button when user has action capability', () => {
    // User has USER_MANAGE
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 1,
            role: 'ADMIN',
            permissions: ['VIEW_USERS', 'USER_MANAGE'],
        },
    });

    render(
        <AuthorizedAction feature="users" action="create" mode="hide">
            <Button data-testid="create-user-btn">Thêm Người Dùng</Button>
        </AuthorizedAction>
    );

    expect(screen.getByTestId('create-user-btn')).toBeInTheDocument();
});

test('AuthorizedAction with mode="disable" disables button with Vietnamese explanation reason', () => {
    // User only has VIEW_ANNOUNCEMENTS, lacks PUBLIC_ANNOUNCEMENT_MANAGE
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 2,
            role: 'LECTURER',
            permissions: ['VIEW_ANNOUNCEMENTS'],
        },
    });

    render(
        <AuthorizedAction
            feature="announcements"
            action="create"
            mode="disable"
            reason="Bạn không có quyền soạn bản tin Portal"
        >
            <Button data-testid="create-announcement-btn">Soạn bản tin</Button>
        </AuthorizedAction>
    );

    const button = screen.getByTestId('create-announcement-btn');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
});

test('Admin role alone without action capability cannot perform academic actions', () => {
    // Technical Admin who does NOT have MENTOR_ASSIGN or PERMISSION_ASSIGN_ACADEMIC
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 3,
            role: 'ADMIN',
            permissions: ['VIEW_USERS', 'VIEW_PROJECT_ENROLLMENTS'],
        },
    });

    render(
        <AuthorizedAction feature="project-enrollments" action="assignMentor" mode="hide">
            <Button data-testid="assign-mentor-btn">Gán GVHD</Button>
        </AuthorizedAction>
    );

    expect(screen.queryByTestId('assign-mentor-btn')).toBeNull();
});

test('AuthorizedAction respects scoped delegation context', () => {
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 4,
            role: 'LECTURER',
            permissions: ['VIEW_ALL_TOPICS'],
            basePermissions: ['VIEW_ALL_TOPICS'],
            activeDelegations: [
                {
                    capabilityCode: 'TOPIC_REVIEW',
                    semesterId: 'sem-2026-1',
                    department: 'CNTT',
                    status: 'ACTIVE',
                },
            ],
        },
    });

    const { rerender } = render(
        <AuthorizedAction
            feature="all-topics"
            action="review"
            context={{ semesterId: 'sem-2026-1', department: 'CNTT' }}
            mode="hide"
        >
            <Button data-testid="review-topic-btn">Duyệt đề tài</Button>
        </AuthorizedAction>
    );

    // Matching scope: visible
    expect(screen.getByTestId('review-topic-btn')).toBeInTheDocument();

    // Mismatched scope: hidden
    rerender(
        <AuthorizedAction
            feature="all-topics"
            action="review"
            context={{ semesterId: 'sem-2026-2', department: 'CNTT' }}
            mode="hide"
        >
            <Button data-testid="review-topic-btn">Duyệt đề tài</Button>
        </AuthorizedAction>
    );
    expect(screen.queryByTestId('review-topic-btn')).toBeNull();
});

