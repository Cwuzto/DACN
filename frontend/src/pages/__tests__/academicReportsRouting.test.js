import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('1. reportService provides required reporting API methods and exports', async () => {
    const reportServiceModule = await import('../../services/reportService.js');
    const apiModule = await import('../../services/api.js');
    const api = apiModule.default;
    const { reportService } = reportServiceModule;
    const defaultExport = reportServiceModule.default;

    assert.ok(reportService, 'reportService named export must exist');
    assert.ok(defaultExport, 'reportService default export must exist');
    assert.equal(typeof reportService.getOverview, 'function', 'getOverview must be a function');
    assert.equal(typeof reportService.getLecturerWorkload, 'function', 'getLecturerWorkload must be a function');
    assert.equal(typeof reportService.exportExcel, 'function', 'exportExcel must be a function');

    // Test parameter delegation to api.get
    const originalGet = api.get;
    const calls = [];
    api.get = async (url, config) => {
        calls.push({ url, config });
        return { data: { success: true, mockUrl: url } };
    };

    try {
        const resOverview = await reportService.getOverview({ semesterId: 10 });
        assert.equal(calls[0].url, '/reports/overview');
        assert.deepEqual(calls[0].config, { params: { semesterId: 10 } });
        assert.equal(resOverview.mockUrl, '/reports/overview');

        const resWorkload = await reportService.getLecturerWorkload({ semesterId: 12 });
        assert.equal(calls[1].url, '/reports/lecturer-workload');
        assert.deepEqual(calls[1].config, { params: { semesterId: 12 } });
        assert.equal(resWorkload.mockUrl, '/reports/lecturer-workload');

        const resExcel = await reportService.exportExcel({ semesterId: 15 });
        assert.equal(calls[2].url, '/reports/export-excel');
        assert.equal(calls[2].config.responseType, 'blob');
        assert.deepEqual(calls[2].config.params, { semesterId: 15 });
        assert.equal(resExcel.mockUrl, '/reports/export-excel');
    } finally {
        api.get = originalGet;
    }
});

test('2. NAVIGATION_REGISTRY includes Academic Reports in Kết quả & báo cáo with REPORT_VIEW', async () => {
    const { NAVIGATION_REGISTRY } = await import('../../config/navigationRegistry.js');
    const academicReportsItem = NAVIGATION_REGISTRY.find((item) => item.key === 'academic-reports');

    assert.ok(academicReportsItem, 'Item with key "academic-reports" must exist in NAVIGATION_REGISTRY');
    assert.equal(academicReportsItem.label, 'Báo cáo học vụ');
    assert.equal(academicReportsItem.icon, 'bar_chart');
    assert.equal(academicReportsItem.group, 'Kết quả & báo cáo');
    assert.equal(academicReportsItem.requiredPermission, 'REPORT_VIEW');
    assert.equal(academicReportsItem.route, '/admin/reports');
});

test('3. ROUTES definition registers ACADEMIC_REPORTS endpoint', () => {
    const routesSrc = read('frontend/src/routes/index.jsx');
    assert.match(
        routesSrc,
        /ACADEMIC_REPORTS:\s*['"]\/admin\/reports['"]/,
        'ROUTES must contain ACADEMIC_REPORTS: "/admin/reports"'
    );
});

test('4. NavIcon includes bar_chart vector SVG icon with feather stroke style', () => {
    const navIconSrc = read('frontend/src/components/layout/NavIcon.jsx');

    assert.match(
        navIconSrc,
        /case\s+['"]bar_chart['"]:/,
        'NavIcon must contain case for bar_chart'
    );
    assert.match(
        navIconSrc,
        /case\s+['"]analytics['"]:/,
        'NavIcon must contain case for analytics'
    );
    assert.match(
        navIconSrc,
        /case\s+['"]poll['"]:/,
        'NavIcon must contain case for poll'
    );
    assert.match(
        navIconSrc,
        /<line\s+x1=["']18["']\s+y1=["']20["']\s+x2=["']18["']\s+y2=["']10["']\s*\/>/,
        'NavIcon bar_chart must contain 3-column SVG line 1'
    );
    assert.match(
        navIconSrc,
        /<line\s+x1=["']12["']\s+y1=["']20["']\s+x2=["']12["']\s+y2=["']4["']\s*\/>/,
        'NavIcon bar_chart must contain 3-column SVG line 2'
    );
    assert.match(
        navIconSrc,
        /<line\s+x1=["']6["']\s+y1=["']20["']\s+x2=["']6["']\s+y2=["']14["']\s*\/>/,
        'NavIcon bar_chart must contain 3-column SVG line 3'
    );
});

test('5. App.jsx lazy loads AcademicReportsPage and registers guarded /admin/reports route with REPORT_VIEW', () => {
    const appSrc = read('frontend/src/App.jsx');
    const policySrc = read('frontend/src/auth/featurePolicies.js');
    const navSrc = read('frontend/src/config/navigationRegistry.js');

    assert.match(
        appSrc,
        /const\s+AcademicReportsPage\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/admin\/AcademicReportsPage['"]\)\);/,
        'App.jsx must lazy load AcademicReportsPage'
    );
    assert.match(
        appSrc,
        /<Route\s+element=\{<ProtectedRoute\s+featureKey=["']academic-reports["']\s+requiredAnyPermissions=\{\[['"]REPORT_VIEW['"]\]\}\s*\/>\}>[\s\S]*?<Route\s+path=["']reports["']\s+element=\{<AcademicReportsPage\s*\/>\}\s*\/>[\s\S]*?<\/Route>/,
        'App.jsx must register reports route with REPORT_VIEW permission'
    );

    assert.match(navSrc, /FEATURE_POLICY_LIST/, 'navigationRegistry must derive from FEATURE_POLICY_LIST');

    const policyBlock = policySrc.match(/'academic-reports':\s*\{[\s\S]*?actions:\s*\{[\s\S]*?\},/);
    assert.ok(policyBlock, 'featurePolicies must define academic-reports');
    assert.strictEqual(policyBlock[0].includes('REPORT_VIEW'), true, 'featurePolicies must use REPORT_VIEW for /admin/reports');
    assert.strictEqual(policyBlock[0].includes('VIEW_PROJECT_OVERSIGHT'), false, 'featurePolicies must separate /admin/reports from VIEW_PROJECT_OVERSIGHT');
});

test('6. AcademicReportsPage placeholder exists and adheres to Rule 2.6', () => {
    const pageSrc = read('frontend/src/pages/admin/AcademicReportsPage.jsx');
    assert.ok(pageSrc.length > 0, 'AcademicReportsPage.jsx must exist');
    assert.match(pageSrc, /export\s+default\s+function\s+AcademicReportsPage/, 'AcademicReportsPage component must be exported');
    // Ensure no raw emojis or symbols in button labels
    const rawSymbolRegex = />[^<]*[\u2190-\u21FF\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF][^<]*<\/Button>/;
    assert.ok(!rawSymbolRegex.test(pageSrc), 'AcademicReportsPage must not have raw emojis or symbols in button labels');
});
