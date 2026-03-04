import api from './api';

const uploadService = {
    /**
     * Upload file lên server (sẽ đẩy thẳng lên Cloudinary và trả về URL)
     * @param {File} file File cần upload
     * @param {string} folder Tên thư mục lưu trên Cloud (vd: 'avatars', 'submissions')
     * @returns {Promise<Object>} URL file và metadata
     */
    uploadFile: async (file, folder = 'general') => {
        // Sử dụng FormData để gửi file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        // Lưu ý: api instance đã được cấu hình kèm Authorization header nếu có token
        // Gọi endpoint POST /api/upload
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        return response.data;
    }
};

export default uploadService;
