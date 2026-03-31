const fs = require('fs');
const path = require('path');

const templatesPath = path.resolve(__dirname, '../data/notificationTemplates.json');

const readTemplates = () => {
    try {
        const raw = fs.readFileSync(templatesPath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
};

const writeTemplates = (templates) => {
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2), 'utf8');
};

const listTemplates = () => readTemplates();

const updateTemplate = (templateKey, payload) => {
    const templates = readTemplates();
    const index = templates.findIndex((item) => item.key === templateKey);
    if (index < 0) return null;

    const current = templates[index];
    templates[index] = {
        ...current,
        name: payload.name ?? current.name,
        title: payload.title ?? current.title,
        content: payload.content ?? current.content,
        autoTrigger: payload.autoTrigger ?? current.autoTrigger,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : current.isActive,
    };

    writeTemplates(templates);
    return templates[index];
};

module.exports = {
    listTemplates,
    updateTemplate,
};
