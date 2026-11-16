const fs = require('fs');
const path = require('path');

/**
 * Helper to parse Prisma schema file into models and enums
 */
function parsePrismaSchema(schemaContent) {
    const lines = schemaContent.split(/\r?\n/);
    const enums = {};
    const models = {};

    let currentBlock = null;

    for (let rawLine of lines) {
        // Strip single line comments
        const commentIndex = rawLine.indexOf('//');
        const line = (commentIndex >= 0 ? rawLine.slice(0, commentIndex) : rawLine).trim();

        if (!line) continue;

        if (line.startsWith('enum ')) {
            const match = line.match(/^enum\s+(\w+)\s*\{/);
            if (match) {
                currentBlock = { type: 'enum', name: match[1], values: [] };
            }
            continue;
        }

        if (line.startsWith('model ')) {
            const match = line.match(/^model\s+(\w+)\s*\{/);
            if (match) {
                currentBlock = {
                    type: 'model',
                    name: match[1],
                    fields: {},
                    uniqueConstraints: [],
                    indexes: [],
                    map: null,
                };
            }
            continue;
        }

        if (line === '}') {
            if (currentBlock) {
                if (currentBlock.type === 'enum') {
                    enums[currentBlock.name] = currentBlock.values;
                } else if (currentBlock.type === 'model') {
                    models[currentBlock.name] = currentBlock;
                }
                currentBlock = null;
            }
            continue;
        }

        if (!currentBlock) continue;

        if (currentBlock.type === 'enum') {
            currentBlock.values.push(line);
        } else if (currentBlock.type === 'model') {
            if (line.startsWith('@@unique(')) {
                const inner = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
                currentBlock.uniqueConstraints.push(inner.trim());
            } else if (line.startsWith('@@index(')) {
                const inner = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
                currentBlock.indexes.push(inner.trim());
            } else if (line.startsWith('@@map(')) {
                const match = line.match(/@@map\("([^"]+)"\)/);
                if (match) {
                    currentBlock.map = match[1];
                }
            } else {
                // Field definition: name type attributes...
                const tokens = line.split(/\s+/);
                const fieldName = tokens[0];
                const fieldType = tokens[1];
                const rest = line.slice(fieldName.length).trim().slice(fieldType.length).trim();

                currentBlock.fields[fieldName] = {
                    name: fieldName,
                    type: fieldType,
                    attributes: rest,
                };
            }
        }
    }

    return { enums, models };
}

describe('Task 2: StoredAsset Schema and Lifecycle Registry Contract', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    let schemaText;
    let parsed;

    beforeAll(() => {
        expect(fs.existsSync(schemaPath)).toBe(true);
        schemaText = fs.readFileSync(schemaPath, 'utf8');
        parsed = parsePrismaSchema(schemaText);
    });

    describe('Enums Definition', () => {
        test('StorageBucket enum has exact values: CONG_KHAI, HOC_VU, CA_NHAN, TAM', () => {
            expect(parsed.enums.StorageBucket).toBeDefined();
            expect(parsed.enums.StorageBucket).toEqual(['CONG_KHAI', 'HOC_VU', 'CA_NHAN', 'TAM']);
        });

        test('AssetVisibility enum has exact values: PUBLIC, PRIVATE', () => {
            expect(parsed.enums.AssetVisibility).toBeDefined();
            expect(parsed.enums.AssetVisibility).toEqual(['PUBLIC', 'PRIVATE']);
        });

        test('AssetScanStatus enum has exact values: PENDING, PASSED, REJECTED, FAILED', () => {
            expect(parsed.enums.AssetScanStatus).toBeDefined();
            expect(parsed.enums.AssetScanStatus).toEqual(['PENDING', 'PASSED', 'REJECTED', 'FAILED']);
        });

        test('AssetStatus enum has exact values: STAGED, ACTIVE, REPLACED, SOFT_DELETED, ORPHANED, PURGED', () => {
            expect(parsed.enums.AssetStatus).toBeDefined();
            expect(parsed.enums.AssetStatus).toEqual([
                'STAGED',
                'ACTIVE',
                'REPLACED',
                'SOFT_DELETED',
                'ORPHANED',
                'PURGED',
            ]);
        });

        test('StoredDocumentType enum has all canonical document types', () => {
            expect(parsed.enums.StoredDocumentType).toBeDefined();
            expect(parsed.enums.StoredDocumentType).toEqual([
                'BM01',
                'BM02',
                'BM02_A',
                'BM03',
                'CHECKPOINT_EVIDENCE',
                'BM04',
                'BM05',
                'ASSIGNMENT_DECISION',
                'ADJUSTMENT_APPENDIX',
                'COUNCIL_DOCUMENT',
                'REPORT_WORD',
                'REPORT_PDF',
                'SLIDE_PPTX',
                'SOURCE_ZIP',
                'CLEARANCE_CERTIFICATE',
                'USER_AVATAR',
                'PORTAL_IMAGE',
                'PORTAL_DOCUMENT',
                'PORTAL_TEMPLATE',
            ]);
        });

        test('AssetUploadTransport enum has exact values: MULTIPART, TUS', () => {
            expect(parsed.enums.AssetUploadTransport).toBeDefined();
            expect(parsed.enums.AssetUploadTransport).toEqual(['MULTIPART', 'TUS']);
        });

        test('AssetUploadSessionStatus enum has exact values: CREATED, UPLOADING, UPLOADED, FINALIZING, COMPLETED, ABORTED, EXPIRED, FAILED', () => {
            expect(parsed.enums.AssetUploadSessionStatus).toBeDefined();
            expect(parsed.enums.AssetUploadSessionStatus).toEqual([
                'CREATED',
                'UPLOADING',
                'UPLOADED',
                'FINALIZING',
                'COMPLETED',
                'ABORTED',
                'EXPIRED',
                'FAILED',
            ]);
        });
    });

    describe('StoredAsset Model', () => {
        test('model StoredAsset exists and maps to stored_assets', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();
            expect(model.map).toBe('stored_assets');
        });

        test('contains required identity, storage, and checksum metadata fields', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();

            // Identity
            expect(model.fields.id).toBeDefined();
            expect(model.fields.id.type).toBe('String');
            expect(model.fields.id.attributes).toContain('@id');
            expect(model.fields.id.attributes).toContain('@default(uuid())');

            // Provider & Bucket
            expect(model.fields.provider.type).toBe('String');
            expect(model.fields.provider.attributes).toContain('@default("supabase")');
            expect(model.fields.bucket.type).toBe('StorageBucket');
            expect(model.fields.objectKey.type).toBe('String');

            // Filename metadata
            expect(model.fields.originalName.type).toBe('String');
            expect(model.fields.normalizedName.type).toBe('String');
            expect(model.fields.extension.type).toBe('String');

            // Content & Checksum
            expect(model.fields.declaredMime.type).toBe('String');
            expect(model.fields.detectedMime.type).toBe('String');
            expect(model.fields.sizeBytes.type).toBe('BigInt');
            expect(model.fields.sha256.type).toBe('String');
            expect(model.fields.sha256.attributes).toContain('@db.VarChar(64)');
        });

        test('contains versioning, visibility, scanning, and lifecycle fields', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();

            expect(model.fields.documentType.type).toBe('StoredDocumentType');
            expect(model.fields.version.type).toBe('Int');
            expect(model.fields.version.attributes).toContain('@default(1)');

            expect(model.fields.visibility.type).toBe('AssetVisibility');
            expect(model.fields.visibility.attributes).toContain('@default(PRIVATE)');
            expect(model.fields.accessPolicy.type).toBe('String?');

            expect(model.fields.scanStatus.type).toBe('AssetScanStatus');
            expect(model.fields.scanStatus.attributes).toContain('@default(PENDING)');
            expect(model.fields.scanMessage.type).toBe('String?');
            expect(model.fields.scanDiagnostics.type).toBe('Json?');
            expect(model.fields.verifiedAt.type).toBe('DateTime?');

            expect(model.fields.status.type).toBe('AssetStatus');
            expect(model.fields.status.attributes).toContain('@default(STAGED)');
            expect(model.fields.retentionUntil.type).toBe('DateTime?');
            expect(model.fields.deletedAt.type).toBe('DateTime?');
        });

        test('unique constraint exists on [bucket, objectKey]', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();
            const hasUniqueBucketObjectKey = model.uniqueConstraints.some((uc) =>
                uc.includes('bucket') && uc.includes('objectKey')
            );
            expect(hasUniqueBucketObjectKey).toBe(true);
        });

        test('self-relation replacedById allows non-destructive version replacement', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();

            expect(model.fields.replacedById.type).toBe('String?');
            expect(model.fields.replacedBy.type).toBe('StoredAsset?');
            expect(model.fields.replacedBy.attributes).toContain('@relation("AssetReplacement"');
            expect(model.fields.replacedBy.attributes).toContain('onDelete: SetNull');

            expect(model.fields.replaces.type).toBe('StoredAsset[]');
            expect(model.fields.replaces.attributes).toContain('@relation("AssetReplacement")');
        });

        test('owner and relation fields never cascade delete on User or TopicRegistration deletion', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();

            // ownerUser must be SetNull on delete
            expect(model.fields.ownerUserId.type).toBe('Int?');
            expect(model.fields.ownerUser.type).toBe('User?');
            expect(model.fields.ownerUser.attributes).toContain('@relation("AssetOwner"');
            expect(model.fields.ownerUser.attributes).toContain('onDelete: SetNull');

            // uploadedBy is mandatory actor reference
            expect(model.fields.uploadedById.type).toBe('Int');
            expect(model.fields.uploadedBy.type).toBe('User');
            expect(model.fields.uploadedBy.attributes).toContain('@relation("AssetUploader"');
            expect(model.fields.uploadedBy.attributes).not.toContain('Cascade');

            // registration must be SetNull on delete, never Cascade
            expect(model.fields.registrationId.type).toBe('Int?');
            expect(model.fields.registration.type).toBe('TopicRegistration?');
            expect(model.fields.registration.attributes).toContain('onDelete: SetNull');
            expect(model.fields.registration.attributes).not.toContain('Cascade');

            // semester and projectCatalog
            expect(model.fields.semesterId.type).toBe('Int?');
            expect(model.fields.semester.type).toBe('Semester?');
            expect(model.fields.semester.attributes).toContain('onDelete: SetNull');

            expect(model.fields.projectCatalogId.type).toBe('Int?');
            expect(model.fields.projectCatalog.type).toBe('ProjectCatalog?');
            expect(model.fields.projectCatalog.attributes).toContain('onDelete: SetNull');
        });

        test('has indexes on foreign keys, lifecycle, checksum, and retention', () => {
            const model = parsed.models.StoredAsset;
            expect(model).toBeDefined();

            const requiredIndexFields = [
                'ownerUserId',
                'registrationId',
                'semesterId',
                'documentType',
                'status',
                'sha256',
                'retentionUntil',
            ];

            for (const field of requiredIndexFields) {
                const hasIndex = model.indexes.some((idx) => idx.includes(field));
                expect(hasIndex).toBe(true);
            }
        });
    });

    describe('StoredAssetUploadSession Model', () => {
        test('model StoredAssetUploadSession exists and maps to stored_asset_upload_sessions', () => {
            const model = parsed.models.StoredAssetUploadSession;
            expect(model).toBeDefined();
            expect(model.map).toBe('stored_asset_upload_sessions');
        });

        test('contains required actor, staging, transport, and expiry metadata', () => {
            const model = parsed.models.StoredAssetUploadSession;
            expect(model).toBeDefined();

            expect(model.fields.id.type).toBe('String');
            expect(model.fields.actorId.type).toBe('Int');
            expect(model.fields.actor.type).toBe('User');
            expect(model.fields.actor.attributes).toContain('@relation("AssetUploadActor"');

            expect(model.fields.documentType.type).toBe('StoredDocumentType');
            expect(model.fields.resourceContext.type).toBe('Json');
            expect(model.fields.stagingBucket.type).toBe('StorageBucket');
            expect(model.fields.stagingBucket.attributes).toContain('@default(TAM)');
            expect(model.fields.stagingPath.type).toBe('String');

            expect(model.fields.transport.type).toBe('AssetUploadTransport');
            expect(model.fields.declaredSizeBytes.type).toBe('BigInt');
            expect(model.fields.declaredMime.type).toBe('String');
            expect(model.fields.originalName.type).toBe('String');
            expect(model.fields.tusUploadId.type).toBe('String?');

            expect(model.fields.status.type).toBe('AssetUploadSessionStatus');
            expect(model.fields.status.attributes).toContain('@default(CREATED)');
            expect(model.fields.expiresAt.type).toBe('DateTime');

            expect(model.fields.finalizedAssetId.type).toBe('String?');
            expect(model.fields.finalizedAsset.type).toBe('StoredAsset?');
            expect(model.fields.finalizedAsset.attributes).toContain('@relation("FinalizedAsset"');
            expect(model.fields.finalizedAsset.attributes).toContain('onDelete: SetNull');
        });

        test('has indexes on actorId, status, and expiresAt', () => {
            const model = parsed.models.StoredAssetUploadSession;
            expect(model).toBeDefined();

            const requiredIndexFields = ['actorId', 'status', 'expiresAt'];
            for (const field of requiredIndexFields) {
                const hasIndex = model.indexes.some((idx) => idx.includes(field));
                expect(hasIndex).toBe(true);
            }
        });
    });

    describe('StoredAssetCleanupJob Model', () => {
        test('model StoredAssetCleanupJob exists and maps to stored_asset_cleanup_jobs', () => {
            const model = parsed.models.StoredAssetCleanupJob;
            expect(model).toBeDefined();
            expect(model.map).toBe('stored_asset_cleanup_jobs');
        });

        test('contains target bucket, object key, asset link, retry and locking fields', () => {
            const model = parsed.models.StoredAssetCleanupJob;
            expect(model).toBeDefined();

            expect(model.fields.id.type).toBe('String');
            expect(model.fields.bucket.type).toBe('StorageBucket');
            expect(model.fields.objectKey.type).toBe('String');
            expect(model.fields.assetId.type).toBe('String?');
            expect(model.fields.asset.type).toBe('StoredAsset?');
            expect(model.fields.asset.attributes).toContain('onDelete: SetNull');

            expect(model.fields.reason.type).toBe('String');
            expect(model.fields.scheduledAt.type).toBe('DateTime');
            expect(model.fields.lockedAt.type).toBe('DateTime?');
            expect(model.fields.lockedBy.type).toBe('String?');
            expect(model.fields.attempts.type).toBe('Int');
            expect(model.fields.attempts.attributes).toContain('@default(0)');
            expect(model.fields.maxAttempts.type).toBe('Int');
            expect(model.fields.maxAttempts.attributes).toContain('@default(5)');
            expect(model.fields.lastError.type).toBe('String?');
            expect(model.fields.completedAt.type).toBe('DateTime?');
        });

        test('has indexes on [scheduledAt, completedAt] and [lockedAt]', () => {
            const model = parsed.models.StoredAssetCleanupJob;
            expect(model).toBeDefined();

            const hasScheduledCompleted = model.indexes.some(
                (idx) => idx.includes('scheduledAt') && idx.includes('completedAt')
            );
            const hasLockedAt = model.indexes.some((idx) => idx.includes('lockedAt'));
            expect(hasScheduledCompleted).toBe(true);
            expect(hasLockedAt).toBe(true);
        });
    });

    describe('Inverse Relations on Business Models', () => {
        test('User model has relations: ownedAssets, uploadedAssets, uploadSessions', () => {
            const user = parsed.models.User;
            expect(user).toBeDefined();

            expect(user.fields.ownedAssets).toBeDefined();
            expect(user.fields.ownedAssets.type).toBe('StoredAsset[]');
            expect(user.fields.ownedAssets.attributes).toContain('@relation("AssetOwner")');

            expect(user.fields.uploadedAssets).toBeDefined();
            expect(user.fields.uploadedAssets.type).toBe('StoredAsset[]');
            expect(user.fields.uploadedAssets.attributes).toContain('@relation("AssetUploader")');

            expect(user.fields.uploadSessions).toBeDefined();
            expect(user.fields.uploadSessions.type).toBe('StoredAssetUploadSession[]');
            expect(user.fields.uploadSessions.attributes).toContain('@relation("AssetUploadActor")');
        });

        test('TopicRegistration model has relation: storedAssets', () => {
            const reg = parsed.models.TopicRegistration;
            expect(reg).toBeDefined();
            expect(reg.fields.storedAssets).toBeDefined();
            expect(reg.fields.storedAssets.type).toBe('StoredAsset[]');
        });

        test('Semester model has relation: storedAssets', () => {
            const semester = parsed.models.Semester;
            expect(semester).toBeDefined();
            expect(semester.fields.storedAssets).toBeDefined();
            expect(semester.fields.storedAssets.type).toBe('StoredAsset[]');
        });

        test('ProjectCatalog model has relation: storedAssets', () => {
            const catalog = parsed.models.ProjectCatalog;
            expect(catalog).toBeDefined();
            expect(catalog.fields.storedAssets).toBeDefined();
            expect(catalog.fields.storedAssets.type).toBe('StoredAsset[]');
        });
    });

    describe('Migration SQL Script Verification', () => {
        const migrationPath = path.resolve(
            __dirname,
            '../../prisma/migrations/20261117090000_add_stored_asset_registry/migration.sql'
        );

        test('migration.sql exists and is non-empty', () => {
            expect(fs.existsSync(migrationPath)).toBe(true);
            const sql = fs.readFileSync(migrationPath, 'utf8');
            expect(sql.length).toBeGreaterThan(100);
        });

        test('migration.sql creates all required enums', () => {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            const expectedEnums = [
                'StorageBucket',
                'AssetVisibility',
                'AssetScanStatus',
                'AssetStatus',
                'StoredDocumentType',
                'AssetUploadTransport',
                'AssetUploadSessionStatus',
            ];
            for (const enumName of expectedEnums) {
                expect(sql).toContain(`CREATE TYPE "${enumName}" AS ENUM`);
            }
        });

        test('migration.sql creates all three tables', () => {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            expect(sql).toContain('CREATE TABLE "stored_assets"');
            expect(sql).toContain('CREATE TABLE "stored_asset_upload_sessions"');
            expect(sql).toContain('CREATE TABLE "stored_asset_cleanup_jobs"');
        });

        test('migration.sql creates unique index on (bucket, object_key)', () => {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            expect(sql).toContain('CREATE UNIQUE INDEX "stored_assets_bucket_object_key_key" ON "stored_assets"("bucket", "object_key")');
        });

        test('migration.sql sets ON DELETE SET NULL for user and registration relations on stored_assets', () => {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            expect(sql).toContain('ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL');
            expect(sql).toContain('ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE SET NULL');
        });
    });
});
