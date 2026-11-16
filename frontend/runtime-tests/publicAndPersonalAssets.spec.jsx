import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

// Import components to test
import ProfileIdentityCard from '../src/components/profile/ProfileIdentityCard.jsx';

describe('Task 9 Frontend: Public and Personal Assets Governance Runtime Tests', () => {
    beforeEach(() => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });
    describe('1. Static Scan: No Hard-coded Supabase Project/Bucket URLs in Frontend Source', () => {
        const forbiddenPattern = /https:\/\/[a-zA-Z0-9_-]+\.supabase\.co\/storage\/v1\/object\/public\//i;

        const filesToScan = [
            path.resolve(__dirname, '../src/index.css'),
            path.resolve(__dirname, '../src/components/layout/AppLayout.jsx'),
            path.resolve(__dirname, '../src/pages/common/HomePage.jsx'),
            path.resolve(__dirname, '../src/pages/admin/portal/TemplateManager.jsx'),
            path.resolve(__dirname, '../src/pages/admin/AnnouncementManagementPage.jsx'),
            path.resolve(__dirname, '../src/pages/common/ProfilePage.jsx'),
        ];

        filesToScan.forEach((filePath) => {
            const relativeName = path.relative(path.resolve(__dirname, '../src'), filePath);
            it(`should not contain hardcoded public Supabase storage URLs in ${relativeName}`, () => {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const match = content.match(forbiddenPattern);
                    expect(match, `Found hardcoded Supabase storage URL in ${relativeName}: ${match ? match[0] : ''}`).toBeNull();
                }
            });
        });
    });

    describe('2. Button & UI Standards (AGENTS.md Compliance)', () => {
        it('ProfileIdentityCard renders action buttons with proper Ant Design icons and clean labels', () => {
            const mockUser = {
                id: 1,
                fullName: 'Nguyễn Văn A',
                email: 'nva@tdmu.edu.vn',
                role: 'STUDENT',
            };

            const { container, rerender } = render(
                <ProfileIdentityCard
                    user={mockUser}
                    editing={false}
                    setEditing={vi.fn()}
                    tempProfile={{ name: mockUser.fullName, avatarUrl: '' }}
                    onFieldChange={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    savingProfile={false}
                    uploading={false}
                    onUploadAvatar={vi.fn()}
                    hasChanges={false}
                />
            );

            // Edit button should exist without raw emojis in text
            const editButton = screen.getByRole('button', { name: /Chỉnh sửa hồ sơ/i });
            expect(editButton).toBeDefined();
            // Should contain Ant Design icon svg inside
            expect(editButton.querySelector('.anticon')).not.toBeNull();
            expect(editButton.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);

            // Rerender in editing mode
            rerender(
                <ProfileIdentityCard
                    user={mockUser}
                    editing={true}
                    setEditing={vi.fn()}
                    tempProfile={{ name: mockUser.fullName, avatarUrl: '' }}
                    onFieldChange={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    savingProfile={false}
                    uploading={false}
                    onUploadAvatar={vi.fn()}
                    hasChanges={true}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /Hủy/i });
            const saveButton = screen.getByRole('button', { name: /Lưu thay đổi/i });

            expect(cancelButton.querySelector('.anticon')).not.toBeNull();
            expect(saveButton.querySelector('.anticon')).not.toBeNull();
            expect(cancelButton.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
            expect(saveButton.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });
    });

    describe('3. TemplateManager File Upload Contract', () => {
        it('TemplateManager file input specifies accepted MIME/extensions for templates', async () => {
            // Read TemplateManager source code and ensure it adheres to governed documents
            const templateManagerSource = fs.readFileSync(
                path.resolve(__dirname, '../src/pages/admin/portal/TemplateManager.jsx'),
                'utf-8'
            );

            // Must accept pdf, doc, docx, xls, xlsx
            expect(templateManagerSource).toContain('.pdf,.doc,.docx,.xls,.xlsx');
            // Must not have hardcoded folder names like folder: 'submissions' or bucket names
            expect(templateManagerSource).not.toMatch(/bucket:\s*['"]dacn['"]/i);
        });
    });
});
