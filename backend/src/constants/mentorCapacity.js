const ACADEMIC_TITLE_LIMITS = {
    THAC_SI: 10,
    TIEN_SI: 15,
    PHO_GIAO_SU: 20,
};

const getMentorMaxSlots = (academicTitle) => ACADEMIC_TITLE_LIMITS[academicTitle] || 10;

module.exports = {
    ACADEMIC_TITLE_LIMITS,
    getMentorMaxSlots,
};
