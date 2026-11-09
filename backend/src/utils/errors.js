class AppError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(typeof message === 'string' ? message : JSON.stringify(message));
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.status = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'BAD_REQUEST', details = null) {
        super(message, 400, details);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'UNAUTHORIZED', details = null) {
        super(message, 401, details);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'FORBIDDEN', details = null) {
        super(message, 403, details);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'NOT_FOUND', details = null) {
        super(message, 404, details);
    }
}

class ConflictError extends AppError {
    constructor(message = 'CONFLICT', details = null) {
        super(message, 409, details);
    }
}

class UnprocessableEntityError extends AppError {
    constructor(message = 'UNPROCESSABLE_ENTITY', details = null) {
        super(message, 422, details);
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableEntityError,
};
