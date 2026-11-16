const { toVietnameseSlug } = require('../../src/storage/vietnameseSlug');

describe('vietnameseSlug', () => {
    describe('Vietnamese diacritics removal and Unicode normalization', () => {
        it('should transliterate NFC Vietnamese string to lowercase slug', () => {
            const input = 'Đồ án tốt nghiệp';
            expect(toVietnameseSlug(input)).toBe('do-an-tot-nghiep');
        });

        it('should transliterate NFD decomposed Vietnamese string identically', () => {
            // NFD decomposition: 'Đo\u0300 a\u0301n tô\u0301t nghiê\u0323p'
            const nfdInput = 'Đồ án tốt nghiệp'.normalize('NFD');
            expect(toVietnameseSlug(nfdInput)).toBe('do-an-tot-nghiep');
        });

        it('should handle both uppercase Đ and lowercase đ correctly', () => {
            expect(toVietnameseSlug('ĐẠI HỌC đà nẵng')).toBe('dai-hoc-da-nang');
        });

        it('should handle complex Vietnamese accents across all vowels', () => {
            const input = 'Á À Ả Ã Ạ Ă Ắ Ằ Ẳ Ẵ Ặ Â Ấ Ầ Ẩ Ẫ Ậ É È Ẻ Ẽ Ẹ Ê Ế Ề Ể Ễ Ệ Í Ì Ỉ Ĩ Ị Ó Ò Ỏ Õ Ọ Ô Ố Ồ Ổ Ỗ Ộ Ơ Ớ Ờ Ở Ỡ Ợ Ú Ù Ủ Ũ Ụ Ư Ứ Ừ Ử Ữ Ự Ý Ỳ Ỷ Ỹ Ỵ';
            const result = toVietnameseSlug(input, { maxLength: 200 });
            expect(result).not.toMatch(/[^\w-]/);
            expect(result).toBe(
                'a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-e-e-e-e-e-e-e-e-e-e-e-i-i-i-i-i-o-o-o-o-o-o-o-o-o-o-o-o-o-o-o-o-o-u-u-u-u-u-u-u-u-u-u-u-y-y-y-y-y'
            );
        });
    });

    describe('Separators and whitespace collapsing', () => {
        it('should collapse multiple spaces and hyphens into a single hyphen', () => {
            expect(toVietnameseSlug('Báo cáo   tiến độ --- đợt   1')).toBe(
                'bao-cao-tien-do-dot-1'
            );
        });

        it('should strip leading and trailing hyphens', () => {
            expect(toVietnameseSlug('---phiếu điểm---')).toBe('phieu-diem');
        });
    });

    describe('Path traversal, slashes, and special characters', () => {
        it('should sanitize directory traversal sequences', () => {
            expect(toVietnameseSlug('../../etc/passwd')).toBe('etc-passwd');
        });

        it('should replace forward and backslashes', () => {
            expect(toVietnameseSlug('folder/sub\\file.docx')).toBe('folder-sub-file-docx');
        });

        it('should strip emojis and special symbols', () => {
            expect(toVietnameseSlug('Báo cáo 🚀 #1 @2026!')).toBe('bao-cao-1-2026');
        });

        it('should fallback safely for Windows reserved device names', () => {
            expect(toVietnameseSlug('con')).toBe('tai-lieu');
            expect(toVietnameseSlug('PRN')).toBe('tai-lieu');
            expect(toVietnameseSlug('aux')).toBe('tai-lieu');
            expect(toVietnameseSlug('NUL')).toBe('tai-lieu');
            expect(toVietnameseSlug('com1')).toBe('tai-lieu');
            expect(toVietnameseSlug('lpt1')).toBe('tai-lieu');
        });
    });

    describe('Edge cases and fallbacks', () => {
        it('should return fallback tai-lieu for empty or whitespace-only inputs', () => {
            expect(toVietnameseSlug('')).toBe('tai-lieu');
            expect(toVietnameseSlug('   ')).toBe('tai-lieu');
            expect(toVietnameseSlug('---...---')).toBe('tai-lieu');
        });

        it('should return fallback tai-lieu for null or non-string inputs', () => {
            expect(toVietnameseSlug(null)).toBe('tai-lieu');
            expect(toVietnameseSlug(undefined)).toBe('tai-lieu');
            expect(toVietnameseSlug(12345)).toBe('12345');
        });
    });

    describe('MaxLength truncation', () => {
        it('should truncate to 80 characters by default without trailing hyphen', () => {
            const longString = 'Một đoạn văn bản rất dài được dùng để kiểm tra độ dài tối đa của slug tiếng Việt có dấu và ký tự đặc biệt';
            const slug = toVietnameseSlug(longString);
            expect(slug.length).toBeLessThanOrEqual(80);
            expect(slug.endsWith('-')).toBe(false);
        });

        it('should respect custom maxLength option', () => {
            const slug = toVietnameseSlug('Báo cáo tiến độ đề tài tốt nghiệp', { maxLength: 15 });
            expect(slug.length).toBeLessThanOrEqual(15);
            expect(slug.endsWith('-')).toBe(false);
            expect(slug).toBe('bao-cao-tien-do');
        });
    });
});
