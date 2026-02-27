import express, { Router } from 'express'
import analysisController from '~/controllers/analysis.controller'

const analysisRouter: Router = express.Router()

/**
 * GET /assistant/lessons/:lessonId/analysis
 *
 * Long-polling endpoint that returns the AI analysis for a lesson.
 * If analysis is not yet complete, the connection is held open (up to 25s)
 * and resolved as soon as summarization completes via Redis pub/sub.
 */
analysisRouter.get('/lessons/:lessonId', analysisController.getAnalysis)

export default analysisRouter
