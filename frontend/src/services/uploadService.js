import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const uploadService = {
    uploadFile: async (file, folder = 'general', metadata = {}) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);
            Object.entries(metadata || {}).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') return;
                formData.append(key, String(value));
            });

            return await api.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải tệp lên');
        }
    },
};

export default uploadService;
