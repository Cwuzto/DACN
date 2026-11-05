import api from './api';

const portalContentService = {
  getPublicContent: () => api.get('/portal/public'),
  listResources: (resourceType) => api.get(`/portal/admin/${resourceType}`),
  createResource: (resourceType) => api.post(`/portal/${resourceType}`),
  createDraft: (resourceType, resourceId, payload) => api.post(`/portal/${resourceType}/${resourceId}/drafts`, payload),
  publishDraft: (resourceType, resourceId, revisionId) => api.post(`/portal/${resourceType}/${resourceId}/revisions/${revisionId}/publish`),
  archive: (resourceType, resourceId) => api.post(`/portal/${resourceType}/${resourceId}/archive`),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/portal/uploads/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadDocument: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/portal/uploads/document', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default portalContentService;
