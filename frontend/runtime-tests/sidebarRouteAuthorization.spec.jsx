import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import ProtectedRoute from '../src/components/common/ProtectedRoute.jsx';
import useAuthStore from '../src/stores/authStore.js';

afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false });
});

function renderGuardedRoutes(initialEntry, user) {
    useAuthStore.setState({ user, isAuthenticated: true });
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/admin/dashboard" element={<div>Admin Home</div>} />
                <Route path="/lecturer/dashboard" element={<div>Lecturer Home</div>} />
                <Route element={<ProtectedRoute featureKey="academic-reports" requiredAnyPermissions={['REPORT_VIEW']} />}>
                    <Route path="/admin/reports" element={<div>Academic Reports Page</div>} />
                </Route>
                <Route element={<ProtectedRoute featureKey="outline-councils" requiredAnyPermissions={['OUTLINE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS']} />}>
                    <Route path="/admin/outline-councils" element={<div>Outline Councils Page</div>} />
                </Route>
                <Route element={<ProtectedRoute featureKey="defense-councils" requiredAnyPermissions={['DEFENSE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS', 'VIEW_DEFENSE_ASSIGNMENTS']} />}>
                    <Route path="/admin/defense-councils" element={<div>Defense Councils Page</div>} />
                </Route>
                <Route element={<ProtectedRoute featureKey="defense-grading" requiredAnyPermissions={['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW']} />}>
                    <Route path="/lecturer/grading" element={<div>Defense Grading Page</div>} />
                </Route>
                <Route element={<ProtectedRoute featureKey="users" requiredAnyPermissions={['EXPLICIT_EXTRA_CAP']} />}>
                    <Route path="/admin/strict-users" element={<div>Strict Users Page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe('Sidebar and route authorization guards', () => {
    it('combines featureKey with explicit requiredAnyPermissions instead of skipping route constraints', () => {
        renderGuardedRoutes('/admin/strict-users', {
            id: 1,
            role: 'ADMIN',
            permissions: ['VIEW_USERS'],
        });
        expect(screen.queryByText('Strict Users Page')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Home')).toBeInTheDocument();
    });

    it('separates /admin/reports (REPORT_VIEW) from oversight and blocks ADMIN without REPORT_VIEW', () => {
        const first = renderGuardedRoutes('/admin/reports', {
            id: 2,
            role: 'ADMIN',
            permissions: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        });
        expect(screen.queryByText('Academic Reports Page')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Home')).toBeInTheDocument();
        first.unmount();

        renderGuardedRoutes('/admin/reports', {
            id: 3,
            role: 'LECTURER',
            permissions: ['REPORT_VIEW'],
        });
        expect(screen.getByText('Academic Reports Page')).toBeInTheDocument();
    });

    it('separates outline-councils and defense-councils guards', () => {
        const first = renderGuardedRoutes('/admin/defense-councils', {
            id: 4,
            role: 'ADMIN',
            permissions: ['OUTLINE_COUNCIL_MANAGE'],
        });
        expect(screen.queryByText('Defense Councils Page')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Home')).toBeInTheDocument();
        first.unmount();

        renderGuardedRoutes('/admin/outline-councils', {
            id: 5,
            role: 'ADMIN',
            permissions: ['DEFENSE_COUNCIL_MANAGE'],
        });
        expect(screen.queryByText('Outline Councils Page')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Home')).toBeInTheDocument();
    });

    it('blocks ADMIN without defense council assignment from /lecturer/grading', () => {
        renderGuardedRoutes('/lecturer/grading', {
            id: 6,
            role: 'ADMIN',
            permissions: ['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW'],
            hasDefenseCouncilAssignment: false,
        });
        expect(screen.queryByText('Defense Grading Page')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Home')).toBeInTheDocument();
    });
});
