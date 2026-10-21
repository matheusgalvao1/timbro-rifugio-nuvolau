import type { ApiErrorCode } from '@nuvolau/shared'

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const errValidation = (message = 'Invalid input') => new AppError('VALIDATION', 400, message)
export const errUnauth = () => new AppError('UNAUTHENTICATED', 401, 'Not signed in')
export const errInvalidCredentials = () =>
  new AppError('INVALID_CREDENTIALS', 401, 'Invalid username or password')
export const errForbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', 403, message)
export const errNotFound = (message = 'Not found') => new AppError('NOT_FOUND', 404, message)
export const errConflict = (message: string) => new AppError('CONFLICT', 409, message)
export const errInternal = (message = 'Something went wrong') =>
  new AppError('INTERNAL', 500, message)
