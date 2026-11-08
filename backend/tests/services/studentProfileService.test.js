const { Prisma, PrismaClient, StudentGender } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

describe('Student profile Prisma contract', () => {
    const profile = Prisma.dmmf.datamodel.models.find((model) => model.name === 'StudentProfile');
    const user = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User');

    test('exports all supported student genders for profile consumers', () => {
        expect(StudentGender).toEqual(expect.objectContaining({
            MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER',
        }));
    });

    test('exposes a studentProfile delegate for persistence', async () => {
        // Construct the real client without opening a database connection.
        const prisma = new PrismaClient({
            adapter: new PrismaPg({ connectionString: 'postgresql://localhost/student_profile_contract' }),
        });

        try {
            expect(prisma.studentProfile).toBeDefined();
            expect(typeof prisma.studentProfile?.upsert).toBe('function');
        } finally {
            await prisma.$disconnect();
        }
    });

    test('exposes the profile fields and database column mapping for consumers', () => {
        expect(profile).toBeDefined();
        expect(profile?.dbName).toBe('student_profiles');
        expect(profile?.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'studentId', type: 'Int', dbName: 'student_id' }),
            expect.objectContaining({ name: 'gender', type: 'StudentGender', kind: 'enum' }),
            expect.objectContaining({ name: 'dateOfBirth', type: 'DateTime', dbName: 'date_of_birth' }),
            expect.objectContaining({ name: 'className', type: 'String', dbName: 'class_name' }),
            expect.objectContaining({ name: 'major', type: 'String' }),
            expect.objectContaining({ name: 'createdAt', type: 'DateTime', dbName: 'created_at' }),
            expect.objectContaining({ name: 'updatedAt', type: 'DateTime', dbName: 'updated_at' }),
        ]));
    });

    test('exposes reciprocal profile and user relations', () => {
        expect(profile?.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'student', type: 'User', kind: 'object', relationName: 'StudentProfileToUser',
            }),
        ]));
        expect(user.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'studentProfile', type: 'StudentProfile', kind: 'object', relationName: 'StudentProfileToUser' }),
        ]));
    });
});
