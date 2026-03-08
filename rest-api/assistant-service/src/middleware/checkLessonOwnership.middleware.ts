import { Request, Response, NextFunction } from 'express'
import ApiError from './ApiError'
import CourseGrpcClient from '~/grpc/courseClient.grpc'

export const checkLessonOwnership = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { lessonId } = req.params;
        const userId = req.user?.sub; // The JWT 'sub' field holds the user ID

        if (!userId) {
            return next(new ApiError(401, 'Unauthorized: Missing user information'))
        }

        if (!lessonId) {
            return next(new ApiError(400, 'Bad Request: Lesson ID is required'))
        }

        const canEdit = await CourseGrpcClient.canEditLesson(lessonId as string, userId)
        if (!canEdit) {
            return next(new ApiError(403, 'Forbidden: You do not have permission to access or edit this lesson'))
        }

        next()
    } catch (e: any) {
        next(new ApiError(e.status || 500, e.message || 'Internal Server Error'))
    }
}
