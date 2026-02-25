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
     * REDUCE step – synthesise N chunk summaries into one lesson summary + suggested title.
     * Returns a JSON object: { summary: string; suggestedTitle: string }
     */
    lessonSystem: () =>
        'You are an expert educational content summarizer. ' +
        'Respond ONLY with a valid JSON object — no markdown, no code fences, no extra text.',

    lessonHuman: (combinedSummaries: string) =>
        'Below are summaries of individual sections of an educational lesson.\n' +
        'Based on these, return a JSON object with exactly two fields:\n' +
        '  - "summary": a comprehensive lesson summary in 4-5 sentences covering the main topics and key learning outcomes.\n' +
        '  - "suggestedTitle": a short, engaging lesson title (max 10 words) that captures the core topic.\n\n' +
        'Section summaries:\n' +
        combinedSummaries,
} as const;

/** Shape returned by the Reduce LLM call. */
export interface LessonReduceResult {
    summary: string;
    suggestedTitle: string;
}
