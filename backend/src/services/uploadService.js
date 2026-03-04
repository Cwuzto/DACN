const cloudinary = require('../config/cloudinary');

class UploadService {
    /**
     * Tải file từ buffer lên Cloudinary
     * @param {Buffer} fileBuffer Buffer của file
     * @param {string} folder Tên thư mục trên Cloudinary (vd: 'avatars', 'submissions')
     * @param {string} resourceType Loại tài nguyên ('image', 'raw', 'auto')
     * @returns {Promise<Object>} Trả về thông tin file từ Cloudinary (có secure_url)
     */
    static async uploadBuffer(fileBuffer, folder = 'general', resourceType = 'auto') {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `dacn/${folder}`, // Tiền tố dacn/ để dễ quản lý trên Cloudinary
                    resource_type: resourceType,
                },
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(result);
                }
            );

            // Ghi buffer vào stream
            uploadStream.end(fileBuffer);
        });
    }

    /**
     * Xóa một file trên Cloudinary bằng public_id
     * @param {string} publicId
     * @returns {Promise<Object>}
     */
    static async deleteFile(publicId, resourceType = 'auto') {
        return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }
}

module.exports = UploadService;
