import { Modal, Empty } from 'antd';

export default function PdfPreviewModal({ open, onCancel, url, title = 'Xem trước PDF' }) {
    return (
        <Modal open={open} onCancel={onCancel} footer={null} title={title} width="min(960px, 94vw)" destroyOnClose>
            {url ? (
                <iframe title={title} src={url} className="w-full h-[70vh] border-0 rounded" />
            ) : <Empty description="Chưa có tệp PDF để xem trước" />}
        </Modal>
    );
}
