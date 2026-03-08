import express, { Router } from 'express'
import analysisController from '~/controllers/analysis.controller'

import Authentication from '~/middleware/auth.midleware'
import { checkLessonOwnership } from '~/middleware/checkLessonOwnership.middleware'
import validateDto from '~/middleware/validateDto.midleware'
import { UpdateChunkSummaryDto } from '~/dto/request/update-chunk.dto'

const analysisRouter: Router = express.Router()

/**
 * GET /assistant/lessons/:lessonId/analysis
 *
 * Long-polling endpoint that returns the AI analysis for a lesson.
 * If analysis is not yet complete, the connection is held open (up to 25s)
 * and resolved as soon as summarization completes via Redis pub/sub.
 */
analysisRouter.get('/lessons/:lessonId', Authentication(true), checkLessonOwnership, analysisController.getAnalysis)

/**
 * PATCH /assistant/lessons/:lessonId/chunks/:chunkId/summary
 * 
 * Allows the instructor to manually edit the AI-generated summary of a specific chunk.
 */
analysisRouter.patch('/lessons/:lessonId/chunks/:chunkId/summary', Authentication(true), checkLessonOwnership, validateDto(UpdateChunkSummaryDto), analysisController.updateChunkSummary)

export default analysisRouter
