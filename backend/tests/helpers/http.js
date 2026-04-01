const createMockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: {},
    ...overrides,
});

const createMockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const createNext = () => jest.fn();

module.exports = {
    createMockReq,
    createMockRes,
    createNext,
};
