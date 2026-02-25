/**
 * Event payload DTOs for lesson analysis internal EventEmitter events.
 * Consumed by `LessonAnalysisEvents` and emitted by `LessonAnalysisService`.
 */

export interface TranscriptSavedPayload {
    lessonId: string;
    subtitles: string;
}

export interface ChunkingCompletedPayload {
    lessonId: string;
    chunkCount: number;
}

export interface ChunkingFailedPayload {
    lessonId: string;
    error: unknown;
}

export interface SummarizationStartedPayload {
    lessonId: string;
    chunkCount: number;
}

export interface SummarizationCompletedPayload {
    lessonId: string;
    chunkCount: number;
}

export interface SummarizationFailedPayload {
    lessonId: string;
    error: unknown;
}
