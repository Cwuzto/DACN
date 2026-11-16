const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLASSIFICATIONS = {
    KEEP_BRANDING: 'KEEP_BRANDING',
    KEEP_EXTERNAL: 'KEEP_EXTERNAL',
    NULL_AND_DELETE: 'NULL_AND_DELETE',
    UNRESOLVED: 'UNRESOLVED',
};

const SENSITIVE_QUERY_PARAMS = new Set([
    'token',
    'secret',
    'sign',
    'signature',
    'sig',
    'key',
    'apikey',
    'api_key',
    'auth',
    'expires',
    'x-amz-signature',
    'x-amz-credential',
    'x-amz-security-token',
]);

const redactUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    try {
        const parsed = new URL(rawUrl);
        let modified = false;
        for (const key of Array.from(parsed.searchParams.keys())) {
            const lowerKey = key.toLowerCase();
            if (
                SENSITIVE_QUERY_PARAMS.has(lowerKey) ||
                lowerKey.includes('token') ||
                lowerKey.includes('secret') ||
                lowerKey.includes('signature')
            ) {
                parsed.searchParams.set(key, '[REDACTED]');
                modified = true;
            }
        }
        return modified ? parsed.toString() : rawUrl;
    } catch {
        return rawUrl;
    }
};

const parseSupabaseStorageUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const match = rawUrl.match(/\/storage\/v1\/object\/(?:public\/|authenticated\/|sign\/)?([^/?#]+)\/([^?#]+)/);
    if (match) {
        return {
            bucket: match[1],
            objectKey: decodeURIComponent(match[2]),
        };
    }
    return null;
};

const classifyUrl = ({ url, table, field }) => {
    if (!url || typeof url !== 'string') return CLASSIFICATIONS.UNRESOLVED;
    const trimmed = url.trim();

    // Check if branding candidate
    const isBranding =
        table === 'portalContentRevision' ||
        field === 'logoUrl' ||
        field === 'backgroundUrl' ||
        trimmed.includes('tdmu-logo') ||
        trimmed.includes('tdmu-campus-hero') ||
        trimmed.includes('thuong-hieu');

    // External check (GitHub, GitLab, Bitbucket, YouTube, Vimeo, etc.)
    const isExternalCodeOrVideo =
        /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org|youtube\.com|youtu\.be|vimeo\.com)/i.test(
            trimmed
        );

    if (isExternalCodeOrVideo && !isBranding) {
        return CLASSIFICATIONS.KEEP_EXTERNAL;
    }

    if (isBranding && !isExternalCodeOrVideo) {
        return CLASSIFICATIONS.KEEP_BRANDING;
    }

    // Check if Supabase storage URL or local /uploads/
    const isLegacyStorageOrUpload =
        trimmed.includes('supabase.co/storage/v1/object/') ||
        trimmed.startsWith('/uploads/') ||
        trimmed.startsWith('uploads/') ||
        trimmed.includes('localhost:5000/uploads') ||
        trimmed.includes('localhost:5173/uploads') ||
        trimmed.startsWith('https://storage.local/');

    if (isLegacyStorageOrUpload) {
        return CLASSIFICATIONS.NULL_AND_DELETE;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            if (
                field === 'referenceUrl' ||
                field === 'sourceCodeUrl' ||
                field === 'demoVideoUrl' ||
                field === 'demoVideoExternalUrl' ||
                field === 'meetingUrl'
            ) {
                return CLASSIFICATIONS.KEEP_EXTERNAL;
            }
        }
    } catch {
        // Not a standard URL
    }

    return CLASSIFICATIONS.UNRESOLVED;
};

const buildLegacyManifest = async ({ db, storage, manifestPath } = {}) => {
    const items = [];

    const MODEL_URL_FIELDS = [
        { table: 'user', fields: ['avatarUrl'] },
        { table: 'semester', fields: ['outlineTemplateFileUrl'] },
        {
            table: 'submission',
            fields: [
                'reportFileUrl',
                'reportWordFileUrl',
                'reportPdfFileUrl',
                'slideFileUrl',
                'sourceCodeUrl',
                'demoVideoUrl',
                'bm03FileUrl',
                'bm04FileUrl',
                'certificatePdfUrl',
            ],
        },
        { table: 'meetingLog', fields: ['fileUrl'] },
        { table: 'defenseResult', fields: ['absentMinutesPdfUrl', 'scoresheetUrl', 'pdfUrl'] },
        { table: 'defenseMemberScore', fields: ['pdfUrl'] },
        { table: 'bM01Evaluation', fields: ['referenceUrl'] },
        { table: 'publicAnnouncement', fields: ['fileUrl'] },
        { table: 'assignmentDecision', fields: ['finalPdfFileUrl'] },
        { table: 'decisionAmendment', fields: ['evidenceUrl'] },
        { table: 'topicAssignmentDecision', fields: ['finalPdfFileUrl'] },
        { table: 'bM02AAdjustmentRequest', fields: ['fileUrl'] },
        { table: 'titleAdjustmentAppendix', fields: ['finalPdfFileUrl'] },
        { table: 'instituteStopReview', fields: ['evidenceFileUrl'] },
        { table: 'instituteDefenseReview', fields: ['evidenceFileUrl'] },
        { table: 'projectArchive', fields: ['demoVideoExternalUrl', 'bm03PdfUrl', 'bm04PdfUrl'] },
        { table: 'defenseDocumentVersion', fields: ['fileUrl', 'demoVideoExternalUrl'] },
    ];

    let counter = 1;

    // Scan standard models
    for (const { table, fields } of MODEL_URL_FIELDS) {
        if (!db[table] || typeof db[table].findMany !== 'function') continue;

        try {
            const records = await db[table].findMany();
            for (const record of records) {
                for (const field of fields) {
                    const rawVal = record[field];
                    if (!rawVal || typeof rawVal !== 'string') continue;

                    const rawUrl = rawVal;
                    const classification = classifyUrl({ url: rawVal, table, field });
                    const redacted = redactUrl(rawVal);
                    const parsedStorage = parseSupabaseStorageUrl(rawVal);

                    let targetBucket = null;
                    let targetObjectKey = null;

                    if (classification === CLASSIFICATIONS.KEEP_BRANDING) {
                        targetBucket = 'cong-khai';
                        targetObjectKey = rawVal.toLowerCase().includes('logo')
                            ? 'thuong-hieu/logo/logo-vien-cong-nghe-so.png'
                            : 'thuong-hieu/background/anh-nen-cong-thong-tin.png';
                    }

                    items.push({
                        id: `item-${counter++}`,
                        classification,
                        sourceType: 'DATABASE',
                        table,
                        field,
                        recordId: record.id,
                        url: redacted,
                        rawUrl,
                        sourceBucket: parsedStorage?.bucket || null,
                        sourceObjectKey: parsedStorage?.objectKey || null,
                        targetBucket,
                        targetObjectKey,
                        status: 'PENDING',
                    });
                }
            }
        } catch (err) {
            // Table might not exist or error in test mock
        }
    }

    // Scan portalContentRevision
    if (db.portalContentRevision && typeof db.portalContentRevision.findMany === 'function') {
        try {
            const revisions = await db.portalContentRevision.findMany();
            for (const rev of revisions) {
                const payload = typeof rev.payload === 'string' ? JSON.parse(rev.payload) : rev.payload || {};
                const checkKeys = ['logoUrl', 'backgroundUrl', 'fileUrl', 'bannerUrl'];
                for (const key of checkKeys) {
                    const rawVal = payload[key];
                    if (!rawVal || typeof rawVal !== 'string') continue;

                    const rawUrl = rawVal;
                    const classification = classifyUrl({ url: rawVal, table: 'portalContentRevision', field: key });
                    const redacted = redactUrl(rawVal);
                    const parsedStorage = parseSupabaseStorageUrl(rawVal);

                    let targetBucket = null;
                    let targetObjectKey = null;

                    if (classification === CLASSIFICATIONS.KEEP_BRANDING) {
                        targetBucket = 'cong-khai';
                        targetObjectKey = key.includes('logo') || rawVal.includes('logo')
                            ? 'thuong-hieu/logo/logo-vien-cong-nghe-so.png'
                            : 'thuong-hieu/background/anh-nen-cong-thong-tin.png';
                    }

                    items.push({
                        id: `item-${counter++}`,
                        classification,
                        sourceType: 'DATABASE',
                        table: 'portalContentRevision',
                        field: key,
                        recordId: rev.id,
                        url: redacted,
                        rawUrl,
                        sourceBucket: parsedStorage?.bucket || null,
                        sourceObjectKey: parsedStorage?.objectKey || null,
                        targetBucket,
                        targetObjectKey,
                        status: 'PENDING',
                    });
                }
            }
        } catch (err) {
            // Ignore if missing in mock
        }
    }

    const summary = {
        total: items.length,
        keepBranding: items.filter((i) => i.classification === CLASSIFICATIONS.KEEP_BRANDING).length,
        keepExternal: items.filter((i) => i.classification === CLASSIFICATIONS.KEEP_EXTERNAL).length,
        nullAndDelete: items.filter((i) => i.classification === CLASSIFICATIONS.NULL_AND_DELETE).length,
        unresolved: items.filter((i) => i.classification === CLASSIFICATIONS.UNRESOLVED).length,
    };

    const manifest = {
        generatedAt: new Date().toISOString(),
        summary,
        items,
    };

    if (manifestPath) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    }

    return manifest;
};

const applyLegacyManifest = async ({
    manifestPath,
    manifest: providedManifest,
    db,
    storage,
    resumeFrom = 0,
    actor = 'SYSTEM',
    dryRun = true,
    snapshotConfirmed = false,
} = {}) => {
    let manifest = providedManifest;
    if (!manifest && manifestPath) {
        const fileContent = fs.readFileSync(manifestPath, 'utf8');
        manifest = JSON.parse(fileContent);
    }

    if (!manifest || !Array.isArray(manifest.items)) {
        throw new Error('INVALID_MANIFEST: Manifest must contain an items array');
    }

    const hasUnresolved = manifest.items.some((i) => i.classification === CLASSIFICATIONS.UNRESOLVED);
    if (hasUnresolved || (manifest.summary && manifest.summary.unresolved > 0)) {
        throw new Error('UNRESOLVED_ITEMS_ABORT: Cannot apply manifest with unresolved items');
    }

    if (!dryRun && !snapshotConfirmed) {
        throw new Error('SNAPSHOT_NOT_CONFIRMED: Database snapshot confirmation required before apply');
    }

    const startedAt = new Date().toISOString();
    const report = {
        dryRun: Boolean(dryRun),
        startedAt,
        actor,
        summary: {
            total: manifest.items.length,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            keepBranding: 0,
            keepExternal: 0,
            nullAndDelete: 0,
        },
        items: [],
    };

    if (dryRun) {
        report.completedAt = new Date().toISOString();
        return report;
    }

    for (let index = resumeFrom; index < manifest.items.length; index++) {
        const item = manifest.items[index];
        report.summary.processed++;

        if (item.status === 'COMPLETED') {
            report.summary.skipped++;
            report.items.push({ id: item.id, status: 'SKIPPED', message: 'Already completed' });
            continue;
        }

        try {
            if (item.classification === CLASSIFICATIONS.KEEP_EXTERNAL) {
                // External URLs remain untouched in DB and storage
                item.status = 'COMPLETED';
                report.summary.succeeded++;
                report.summary.keepExternal++;
                report.items.push({ id: item.id, status: 'COMPLETED', action: 'KEEP_EXTERNAL' });
                continue;
            }

            if (item.classification === CLASSIFICATIONS.KEEP_BRANDING) {
                // Copy/preserve branding asset
                const sourceBucket = item.sourceBucket || 'cong-khai';
                const sourceKey = item.sourceObjectKey || item.url;
                const targetBucket = item.targetBucket || 'cong-khai';
                const targetKey = item.targetObjectKey;

                const isSameLocation = sourceBucket === targetBucket && sourceKey === targetKey;

                if (!isSameLocation && targetKey) {
                    const data = await storage.download({ bucket: sourceBucket, objectKey: sourceKey });
                    let bufferData = data;
                    if (data && typeof data.arrayBuffer === 'function') {
                        bufferData = Buffer.from(await data.arrayBuffer());
                    }

                    await storage.upload({
                        bucket: targetBucket,
                        objectKey: targetKey,
                        data: bufferData,
                        contentType: 'image/png',
                        upsert: false,
                    });

                    // Verify target before deleting source
                    const statResult = await storage.stat({ bucket: targetBucket, objectKey: targetKey });
                    if (!statResult || statResult.size === 0) {
                        throw new Error(`Target verification failed for branding ${targetKey}`);
                    }

                    // Remove source only after target is verified
                    if (storage.remove && typeof storage.remove === 'function') {
                        await storage.remove({ bucket: sourceBucket, objectKey: sourceKey });
                    }
                }

                item.status = 'COMPLETED';
                report.summary.succeeded++;
                report.summary.keepBranding++;
                report.items.push({ id: item.id, status: 'COMPLETED', action: 'KEEP_BRANDING' });
                continue;
            }

            if (item.classification === CLASSIFICATIONS.NULL_AND_DELETE) {
                // Null DB field
                if (item.table && item.recordId && item.field && db[item.table]) {
                    await db[item.table].update({
                        where: { id: item.recordId },
                        data: { [item.field]: null },
                    });
                }

                // Delete storage object if present
                if (item.sourceBucket && item.sourceObjectKey && storage && typeof storage.remove === 'function') {
                    await storage.remove({
                        bucket: item.sourceBucket,
                        objectKey: item.sourceObjectKey,
                    });
                }

                item.status = 'COMPLETED';
                report.summary.succeeded++;
                report.summary.nullAndDelete++;
                report.items.push({ id: item.id, status: 'COMPLETED', action: 'NULL_AND_DELETE' });
                continue;
            }
        } catch (err) {
            item.status = 'FAILED';
            item.error = err.message;
            report.summary.failed++;
            report.items.push({ id: item.id, status: 'FAILED', error: err.message });
        }
    }

    report.completedAt = new Date().toISOString();
    return report;
};

module.exports = {
    CLASSIFICATIONS,
    classifyUrl,
    redactUrl,
    parseSupabaseStorageUrl,
    buildLegacyManifest,
    applyLegacyManifest,
};
