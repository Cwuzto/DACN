import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const uploadService = {
    uploadFile: async (file, folder = 'general') => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

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
