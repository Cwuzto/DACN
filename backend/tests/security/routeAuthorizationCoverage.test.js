const { PERMISSION_CATALOG } = require('../../src/constants/permissions');
const {
    PLATFORM_AUTHORIZATION_EXEMPTIONS,
    ACADEMIC_AUTHORIZATION_EXEMPTIONS,
} = require('../../src/security/authorizationExemptions');

const PLATFORM_ROUTERS = {
    announcementRoutes: require('../../src/routes/announcementRoutes'),
    userRoutes: require('../../src/routes/userRoutes'),
    semesterRoutes: require('../../src/routes/semesterRoutes'),
    projectEnrollmentRoutes: require('../../src/routes/projectEnrollmentRoutes'),
    dashboardRoutes: require('../../src/routes/dashboardRoutes'),
    notificationRoutes: require('../../src/routes/notificationRoutes'),
    rubricRoutes: require('../../src/routes/rubricRoutes'),
    manualReviewRoutes: require('../../src/routes/manualReviewRoutes'),
    permissionRoutes: require('../../src/routes/permissionRoutes'),
    portalContentRoutes: require('../../src/routes/portalContentRoutes'),
};

const ACADEMIC_ROUTERS = {
    topicRoutes: require('../../src/routes/topicRoutes'),
    registrationRoutes: require('../../src/routes/registrationRoutes'),
    taskRoutes: require('../../src/routes/taskRoutes'),
    meetingLogRoutes: require('../../src/routes/meetingLogRoutes'),
};

const routeKey = (routeFile, method, path) => `${routeFile}:${method}:${path}`;

const collectRoutePolicies = (routeFile, router) => {
    const activePolicies = [];
    const routes = [];

    for (const layer of router.stack) {
        if (!layer.route) {
            if (layer.handle?.authorizationPolicy) {
                activePolicies.push(layer.handle.authorizationPolicy);
            }
            continue;
        }

        const localPolicies = layer.route.stack
            .map((routeLayer) => routeLayer.handle?.authorizationPolicy)
            .filter(Boolean);
        for (const method of Object.keys(layer.route.methods).filter((name) => layer.route.methods[name])) {
            routes.push({
                key: routeKey(routeFile, method.toUpperCase(), layer.route.path),
                policies: [...activePolicies, ...localPolicies],
            });
        }
    }

    return routes;
};

describe('Platform route authorization coverage', () => {
    test('every platform endpoint has capability metadata or an exact approved exemption', () => {
        const exemptions = new Set(PLATFORM_AUTHORIZATION_EXEMPTIONS.map((item) => (
            routeKey(item.routeFile, item.method, item.path)
        )));
        const uncovered = [];

        for (const [routeFile, router] of Object.entries(PLATFORM_ROUTERS)) {
            for (const route of collectRoutePolicies(routeFile, router)) {
                if (route.policies.length === 0 && !exemptions.has(route.key)) {
                    uncovered.push(route.key);
                }
            }
        }

        expect(uncovered).toEqual([]);
    });

    test('all route policy metadata references catalog permissions', () => {
        const catalogCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));
        const unknownCodes = [];

        for (const [routeFile, router] of Object.entries(PLATFORM_ROUTERS)) {
            for (const route of collectRoutePolicies(routeFile, router)) {
                for (const policy of route.policies) {
                    for (const code of policy.permissions) {
                        if (!catalogCodes.has(code)) unknownCodes.push(`${routeFile}:${code}`);
                    }
                }
            }
        }

        expect(unknownCodes).toEqual([]);
    });

    test('authorization exemptions are exact, unique, and documented', () => {
        const keys = PLATFORM_AUTHORIZATION_EXEMPTIONS.map((item) => (
            routeKey(item.routeFile, item.method, item.path)
        ));

        expect(new Set(keys).size).toBe(keys.length);
        for (const exemption of PLATFORM_AUTHORIZATION_EXEMPTIONS) {
            expect(['PUBLIC', 'SELF_SERVICE', 'OWNERSHIP_GUARDED']).toContain(exemption.type);
            expect(exemption.reason.trim().length).toBeGreaterThan(0);
        }
    });
});

describe('Academic route authorization coverage', () => {
    test('every academic endpoint in slice 2 has capability metadata or an exact exemption', () => {
        const exemptions = new Set(ACADEMIC_AUTHORIZATION_EXEMPTIONS.map((item) => (
            routeKey(item.routeFile, item.method, item.path)
        )));
        const uncovered = [];

        for (const [routeFile, router] of Object.entries(ACADEMIC_ROUTERS)) {
            for (const route of collectRoutePolicies(routeFile, router)) {
                if (route.policies.length === 0 && !exemptions.has(route.key)) uncovered.push(route.key);
            }
        }

        expect(uncovered).toEqual([]);
    });
});
