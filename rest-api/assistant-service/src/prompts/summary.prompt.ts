/**
 * Prompts used by SummaryService for Map-Reduce summarization.
 *
 * Keeping prompts in a dedicated folder makes them easy to review,
 * tune, and version-control independently from business logic.
 */

export const SummaryPrompts = {
    /**
     * MAP step – summarise a single chunk of a lesson transcript.
     */
    chunkSystem: () =>
        'You are an expert at summarizing educational video transcripts. ' +
        'Your summaries are clear, concise, and capture the key learning points.',

    chunkHuman: (content: string) =>
        'Summarize the following transcript excerpt from an educational lesson in 2-3 concise sentences. ' +
        'Focus on the main concepts taught:\n\n' +
        content,

    /**
     * REDUCE step – synthesise N chunk summaries into one lesson summary.
     */
    lessonSystem: () =>
        'You are an expert educational content summarizer. ' +
        'Synthesize section summaries into a single, coherent lesson overview.',

    lessonHuman: (combinedSummaries: string) =>
        'Below are summaries of individual sections of an educational video lesson. ' +
        'Synthesize these into a single comprehensive lesson summary in 4-5 sentences. ' +
        'Highlight the main topics covered and key learning outcomes:\n\n' +
        combinedSummaries,
} as const;
