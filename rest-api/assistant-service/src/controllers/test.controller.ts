
import { Request, Response, NextFunction } from 'express';
import { SemanticChunkingService } from '~/service/chunking/SemanticChunkingService';
import sendResponse from '~/dto/response/send-response';
import { StatusCodes } from 'http-status-codes';

class TestController {
    private semanticChunkingService: SemanticChunkingService;

    constructor() {
        this.semanticChunkingService = new SemanticChunkingService();
    }

    testChunking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    message: 'filePath is required'
                });
                return;
            }

            const chunks = await this.semanticChunkingService.processTextFile(filePath);
            this.semanticChunkingService.logSemanticChunks(chunks);

            sendResponse(res, {
                code: StatusCodes.OK,
                message: 'Success',
                result: chunks
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new TestController();
