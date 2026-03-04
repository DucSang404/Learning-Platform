import { StatusCodes } from 'http-status-codes'
import ApiError from './ApiError'
import { Request, Response, NextFunction } from 'express'
import Logger from '~/utils/logger'

// Centralized error handling middleware for the NodeJS (ExpressJS) backend application
export const errorHandlingMiddleware = (err: ApiError, req: Request, res: Response, next: NextFunction) => {
  // If the developer forgets to set a status code, default to 500 INTERNAL_SERVER_ERROR
  if (!err.status) err.status = StatusCodes.INTERNAL_SERVER_ERROR

  // Create a responseError object to control what is returned to the client
  const responseError = {
    code: err.status,
    message: err.message || StatusCodes[err.status], // If there is no custom message, use the standard ReasonPhrase based on the Status Code
    stack: err.stack
  }

  Logger.error(`Error occurred: ${JSON.stringify(responseError)}`)
  // Logger.error(responseError)

  // Only return the stack trace in DEV environment for easier debugging.
  // Otherwise, remove it in production.
  // (For more details, see video 55 in the MERN Stack series on the TrungQuanDev YouTube channel.)
  // if (env.BUILD_MODE !== 'dev') delete responseError.stack

  // This section can be extended in the future, such as:
  // - Writing error logs to a file
  // - Sending error notifications to Slack, Telegram, Email, etc.
  // - Or moving this logic into a separate middleware depending on project structure
  // ...
  // Logger.error(responseError)

  // Send responseError back to the Front-end
  res.status((err.status !== 401 && err.status !== 403) ? StatusCodes.OK : err.status).json(responseError)
}