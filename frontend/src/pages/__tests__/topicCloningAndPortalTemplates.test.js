import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 5: topicService exports getCloneableTopics and cloneTopics', () => {
    const topicServiceSrc = read('frontend/src/services/topicService.js');

    assert.match(
        topicServiceSrc,
        /getCloneableTopics\s*:\s*async/,
        'topicService must have getCloneableTopics method'
    );
    assert.match(
        topicServiceSrc,
        /\/topics\/cloneable/,
        'topicService.getCloneableTopics must call /topics/cloneable'
    );

    assert.match(
        topicServiceSrc,
        /cloneTopics\s*:\s*async/,
        'topicService must have cloneTopics method'
    );
    assert.match(
        topicServiceSrc,
        /\/topics\/clone/,
        'topicService.cloneTopics must call /topics/clone'
    );

    assert.match(
        topicServiceSrc,
        /export const getCloneableTopics/,
        'topicService must export getCloneableTopics directly'
    );
    assert.match(
        topicServiceSrc,
        /export const cloneTopics/,
        'topicService must export cloneTopics directly'
    );
});

test('Task 5: TopicManagementPage connects real topic cloning and removes mock topics & toasts', () => {
    const pageSrc = read('frontend/src/pages/lecturer/TopicManagementPage.jsx');

    // Elimination of hardcoded mock topics
    assert.ok(
        !pageSrc.includes('DT-2025-042'),
        'TopicManagementPage must not contain hardcoded mock topic DT-2025-042'
    );
    assert.ok(
        !pageSrc.includes('DT-2025-055'),
        'TopicManagementPage must not contain hardcoded mock topic DT-2025-055'
    );
    assert.ok(
        !pageSrc.includes('Đã sao chép 2 đề tài thành công!'),
        'TopicManagementPage must not contain fake mock toast "Đã sao chép 2 đề tài thành công!"'
    );

    // Connected real service calls
    assert.match(
        pageSrc,
        /topicService\s*\.\s*getCloneableTopics/,
        'TopicManagementPage must call topicService.getCloneableTopics'
    );
    assert.match(
        pageSrc,
        /topicService\s*\.\s*cloneTopics/,
        'TopicManagementPage must call topicService.cloneTopics'
    );

    // Modal with Ant Design Table and empty state
    assert.match(
        pageSrc,
        /<Modal[^>]*open=\{cloneModalOpen\}/,
        'TopicManagementPage must use Ant Design Modal for clone modal'
    );
    assert.match(
        pageSrc,
        /Sao Chép Đề Tài Từ Học Kỳ Trước/,
        'TopicManagementPage clone modal title must be "Sao Chép Đề Tài Từ Học Kỳ Trước"'
    );
    assert.match(
        pageSrc,
        /Không có đề tài từ các học kỳ trước để sao chép/,
        'TopicManagementPage must render Empty state when no cloneable topics'
    );
    assert.match(
        pageSrc,
        /Sao chép sang kỳ này/,
        'TopicManagementPage must have confirmation button "Sao chép sang kỳ này"'
    );
    assert.match(
        pageSrc,
        /CopyOutlined/,
        'TopicManagementPage clone button must use CopyOutlined icon'
    );
});

test('Task 5: RubricManagementPage integrates portalContentService and removes mock download toasts', () => {
    const pageSrc = read('frontend/src/pages/admin/RubricManagementPage.jsx');

    // Elimination of fake download toasts
    assert.ok(
        !pageSrc.includes('Đang tải mẫu chuẩn:'),
        'RubricManagementPage must not contain fake toast "Đang tải mẫu chuẩn:"'
    );

    // Integration of portalContentService
    assert.match(
        pageSrc,
        /import portalContentService from '\.\.\/\.\.\/services\/portalContentService'/,
        'RubricManagementPage must import portalContentService'
    );
    assert.match(
        pageSrc,
        /portalContentService\.getPublicContent/,
        'RubricManagementPage must call portalContentService.getPublicContent'
    );

    // Real download vs disabled tooltip check
    assert.match(
        pageSrc,
        /window\.open\((?:form|previewForm)\.fileUrl,\s*['_"]_blank['_"]\)/,
        'RubricManagementPage must open real fileUrl in new window for download'
    );
    assert.match(
        pageSrc,
        /Biểu mẫu chưa được tải lên hệ thống/,
        'RubricManagementPage must display tooltip when file is not yet uploaded'
    );
    assert.match(
        pageSrc,
        /Chưa có file/,
        'RubricManagementPage must show disabled button "Chưa có file" when no fileUrl'
    );
});

test('Task 5: Strict Button standards (Rule 2.6 in AGENTS.md) across modified files', () => {
    // Regex checking for raw emoji or graphic symbols in button text
    const rawSymbolRegex = />\s*[^<]*[←→+🤖✓✏️👥🗑️🔓▾▴↗📖🏛️⏰✕]\s*[^<]*<\/(?:Button|button)>/;

    const filesToCheck = [
        'frontend/src/pages/lecturer/TopicManagementPage.jsx',
        'frontend/src/pages/admin/RubricManagementPage.jsx',
    ];

    for (const relPath of filesToCheck) {
        const content = read(relPath);
        assert.ok(
            !rawSymbolRegex.test(content),
            `Rule 2.6 violation: Raw emoji or special character found in Button text in ${relPath}`
        );
    }
});
