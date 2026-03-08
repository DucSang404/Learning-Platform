import { LessonTypeEnum } from '~/enums/lessonType.enum';

/**
 * Payload for triggering a lesson analysis job (video transcription or article extraction).
 * Published by the RabbitMQ consumer and consumed by `LessonAnalysisService`.
 */
export interface LessonAnalysisEvent {
    lessonId: string;
    fileUrl: string;
    fileType: LessonTypeEnum;
}
