import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import sendResponse from '~/dto/response/send-response'
import analysisService from '~/service/analysis/analysis.service'
import { AnalysisOutcome } from '~/enums/analysisOutcome.enum'

class AnalysisController {
    /**
     * GET /lessons/:lessonId/analysis
     *
     * Thin HTTP adapter — delegates all long-polling logic to AnalysisService.
     * Creates an AbortController so the service can clean up if the client disconnects.
     */
    getAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const lessonId = String(req.params.lessonId)

        try {
            const abort = new AbortController()
            req.on('close', () => abort.abort())

            const result = await analysisService.waitForAnalysis(lessonId, abort.signal)

            switch (result.outcome) {
                case AnalysisOutcome.NOT_FOUND:
                    sendResponse(res, {
                        code: StatusCodes.NOT_FOUND,
                        message: `Lesson ${lessonId} not found in assistant service`,
                        result: null,
                    })
                    break

                case AnalysisOutcome.COMPLETED:
                    sendResponse(res, {
                        code: StatusCodes.OK,
                        message: 'Analysis complete',
                        result: result.data,
                    })
                    break

                case AnalysisOutcome.PROCESSING:
                    sendResponse(res, {
                        code: StatusCodes.ACCEPTED,
                        message: 'Analysis still processing, please retry',
                        result: result.data,
                    })
                    break

                case AnalysisOutcome.ABORTED:
                    // Client disconnected — do nothing, connection is already closed
                    break
            }
        } catch (error) {
            next(error)
        }
    }
}

export default new AnalysisController()
