jest.mock('../../src/services/uploadService', () => ({ uploadBuffer: jest.fn() }));

const UploadService = require('../../src/services/uploadService');
const { uploadPortalImage } = require('../../src/controllers/portalUploadController');

describe('portal upload controller', () => {
  test('stores an authenticated image in the server-selected portal image folder', async () => {
    UploadService.uploadBuffer.mockResolvedValue({
      secure_url: 'https://storage.example.edu/portal/images/logo.png',
      public_id: 'portal/images/logo.png',
      bytes: 120,
    });
    const req = { file: { buffer: Buffer.from('image'), mimetype: 'image/png', originalname: 'Logo.png' } };
    const res = { json: jest.fn() };

    await uploadPortalImage(req, res, jest.fn());

    expect(UploadService.uploadBuffer).toHaveBeenCalledWith(req.file.buffer, 'portal/images', 'image/png', 'Logo.png');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
