
class AppError extends Error {
    constructor(message, status = 500, errorCode = 'INTERNAL_ERROR') {
      super(message)
      this.status = status
      this.errorCode = errorCode
      Error.captureStackTrace(this, this.constructor)
    }
}
  
module.exports = AppError
  