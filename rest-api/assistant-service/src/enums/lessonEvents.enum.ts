/**
 * Enum of all internal EventEmitter event names used within the assistant-service.
 * Using an enum prevents typos and makes event names easy to discover.
 */
export enum LessonEvent {
    /** Fired after a lesson's transcript + subtitles have been saved to the DB.
     *  Payload: { lessonId: string; subtitles: string } */
    TRANSCRIPT_SAVED = 'lesson:transcript_saved',

    /** Fired when semantic chunking for a lesson has completed successfully.
     *  Payload: { lessonId: string; chunkCount: number } */
    CHUNKING_COMPLETED = 'lesson:chunking_completed',

    /** Fired when the chunking pipeline encounters an unrecoverable error.
     *  Payload: { lessonId: string; error: unknown } */
    CHUNKING_FAILED = 'lesson:chunking_failed',

    /** Fired when the Map-Reduce summarization pipeline starts.
     *  Payload: { lessonId: string; chunkCount: number } */
    SUMMARIZATION_STARTED = 'lesson:summarization_started',

    /** Fired when summarization has completed and lesson.summary is saved.
     *  Payload: { lessonId: string; chunkCount: number } */
    SUMMARIZATION_COMPLETED = 'lesson:summarization_completed',

    /** Fired when the summarization pipeline encounters an error.
     *  Payload: { lessonId: string; error: unknown } */
    SUMMARIZATION_FAILED = 'lesson:summarization_failed',
}
