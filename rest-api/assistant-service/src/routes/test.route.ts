
import express from 'express';
import testController from '~/controllers/test.controller';
import basicAuthMiddleware from '~/middleware/basicAuth.middleware';

const router = express.Router();

// Apply basic auth middleware
router.use(basicAuthMiddleware);

router.post('/chunking', testController.testChunking);

export default router;
