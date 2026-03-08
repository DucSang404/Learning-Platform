import EventEmitter from 'events';
import Logger from '~/utils/logger';
import AssemblyAIService from '~/service/utils/assemblyai.service';
import prismaService from '~/service/utils/prisma.service';
import { DocumentService } from '~/service/utils/document.service';
import { LessonTypeEnum } from '~/enums/lessonType.enum';
import { LessonEvent } from '~/enums/lessonEvents.enum';
import { LessonAnalysisEvents } from '~/service/events/lessonAnalysis.events';
import { TranscriptSavedPayload } from '~/dto/event/lesson-analysis-events.dto';
import { SemanticChunkingService } from '~/service/chunking/semanticChunking.service';
import { LessonAnalysisEvent } from '~/dto/request/lesson-analysis.dto';
import { SummaryService } from '~/service/analysis/summary.service';

class LessonAnalysisService {
    private static instance: LessonAnalysisService;

    private documentService: DocumentService;

    /** Shared event bus for async, decoupled post-processing pipelines */
    private emitter: EventEmitter;

    private constructor() {
        this.documentService = new DocumentService();
        this.emitter = new EventEmitter();

        // Wire all lesson event listeners (chunking pipeline, summarization, logging, etc.)
        new LessonAnalysisEvents(this.emitter, new SemanticChunkingService(), new SummaryService());
    }

    public static getInstance(): LessonAnalysisService {
        if (!LessonAnalysisService.instance) {
            LessonAnalysisService.instance = new LessonAnalysisService();
        }
        return LessonAnalysisService.instance;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    public async handleLessonAnalysisEvent(event: LessonAnalysisEvent): Promise<void> {
        Logger.info(
            `Received lesson analysis event for lessonId: ${event.lessonId}, type: ${event.fileType}`
        );

        try {
            if (event.fileType === LessonTypeEnum.VIDEO) {
                await this.handleVideoAnalysis(event);
            } else if (event.fileType === LessonTypeEnum.ARTICLE) {
                await this.handleArticleAnalysis(event);
            }
        } catch (error) {
            Logger.error(`Error processing lesson analysis event: ${error}`);
        }
    }

    public async processTranscriptCompletion(transcriptId: string): Promise<void> {
        const transcript = await AssemblyAIService.getTranscript(transcriptId);
        if (transcript && transcript.text) {
            const subtitles = await AssemblyAIService.getSubtitles(transcriptId, 'srt');
            await this.createOrUpdateLessonFromTranscript(
                transcriptId,
                transcript.text,
                subtitles,
                transcript.audio_url
            );
        }
    }

    // -----------------------------------------------------------------------
    // Private Handlers
    // -----------------------------------------------------------------------
    private async handleVideoAnalysis(event: LessonAnalysisEvent): Promise<void> {
        Logger.info('Starting video analysis flow...');

        // 1. Submit video for transcription
        const transcript = await AssemblyAIService.transcribeVideo(event.fileUrl);
        Logger.info(`Transcription submitted. Id: ${transcript.id}`);

        // 2. Save / update lesson with transcriptId
        await prismaService.lesson.upsert({
            where: { id: event.lessonId },
            update: {
                url: event.fileUrl,
                transcriptId: transcript.id,
            },
            create: {
                id: event.lessonId,
                url: event.fileUrl,
                transcriptId: transcript.id,
            },
        });

        Logger.info(`Lesson ${event.lessonId} updated with transcriptId ${transcript.id}`);
    }

    private async handleArticleAnalysis(event: LessonAnalysisEvent): Promise<void> {
        Logger.info('Starting article analysis flow...');

        // 1. Extract content from PDF / document
        const content = await this.documentService.getPdfContentFromUrl(event.fileUrl);
        Logger.info(`Content extracted for lesson ${event.lessonId}`);

        // 2. Save to DB
        await prismaService.lesson.upsert({
            where: { id: event.lessonId },
            update: { url: event.fileUrl, transcript: content },
            create: { id: event.lessonId, url: event.fileUrl, transcript: content },
        });

        Logger.info(`Lesson ${event.lessonId} updated with content.`);

        // 3. Emit TRANSCRIPT_SAVED → reuses the same chunking → summarization pipeline
        //    as the video flow. processRawText() handles plain text as well as SRT.
        this.emitter.emit(LessonEvent.TRANSCRIPT_SAVED, {
            lessonId: event.lessonId,
            subtitles: content,
            isSrt: false,
        } satisfies TranscriptSavedPayload);
    }

    private async createOrUpdateLessonFromTranscript(
        transcriptId: string,
        transcriptText: string,
        subtitles: string,
        audioUrl: string
    ): Promise<void> {
        // Try to find by transcriptId first
        let lesson = await prismaService.lesson.findUnique({
            where: { transcriptId },
        });

        if (lesson) {
            Logger.info(`Updating lesson with transcriptId ${transcriptId}`);
            await prismaService.lesson.update({
                where: { id: lesson.id },
                data: {
                    transcript: transcriptText,
                    subtitles: subtitles,
                    url: audioUrl,
                },
            });

            // Emit event → triggers chunking pipeline asynchronously
            this.emitter.emit(LessonEvent.TRANSCRIPT_SAVED, {
                lessonId: lesson.id,
                subtitles,
            } satisfies TranscriptSavedPayload);

            return;
        }

        // Try to find by URL
        const existingLessonByUrl = await prismaService.lesson.findFirst({
            where: { url: audioUrl },
        });

        if (existingLessonByUrl) {
            Logger.info(`Updating lesson with url ${audioUrl}`);
            await prismaService.lesson.update({
                where: { id: existingLessonByUrl.id },
                data: {
                    transcriptId,
                    transcript: transcriptText,
                    subtitles,
                },
            });

            this.emitter.emit(LessonEvent.TRANSCRIPT_SAVED, {
                lessonId: existingLessonByUrl.id,
                subtitles,
            } satisfies TranscriptSavedPayload);

            return;
        }

        Logger.info(`Creating new lesson for transcriptId ${transcriptId}`);
        const newLesson = await prismaService.lesson.create({
            data: {
                transcriptId,
                transcript: transcriptText,
                subtitles,
                url: audioUrl,
            },
        });

        this.emitter.emit(LessonEvent.TRANSCRIPT_SAVED, {
            lessonId: newLesson.id,
            subtitles,
        } satisfies TranscriptSavedPayload);
    }

}

export default LessonAnalysisService;
