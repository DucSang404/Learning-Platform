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
        'Your summaries are clear, concise, and capture the key learning points. ' +
        'Always respond in Vietnamese.',

    chunkHuman: (content: string) =>
        'Tóm tắt đoạn transcript sau từ một bài học giáo dục trong 2-3 câu ngắn gọn bằng tiếng Việt. ' +
        'Tập trung vào các khái niệm chính được trình bày:\n\n' +
        content,

    /**
     * REDUCE step – synthesise N chunk summaries into one lesson summary + suggested title.
     * Returns a JSON object: { summary: string; suggestedTitle: string }
     */
    lessonSystem: () =>
        'You are an expert educational content summarizer. ' +
        'Always respond in Vietnamese. ' +
        'Respond ONLY with a valid JSON object — no markdown, no code fences, no extra text.',

    lessonHuman: (combinedSummaries: string) =>
        'Dưới đây là tóm tắt của từng phần trong một bài học giáo dục.\n' +
        'Dựa trên các phần này, hãy trả về một JSON object với đúng hai trường:\n' +
        '  - "summary": tóm tắt toàn diện bài học trong 4-5 câu tiếng Việt, bao gồm các chủ đề chính và kết quả học tập quan trọng.\n' +
        '  - "suggestedTitle": tiêu đề ngắn gọn, hấp dẫn bằng tiếng Việt (tối đa 10 từ) phản ánh chủ đề cốt lõi.\n\n' +
        'Tóm tắt từng phần:\n' +
        combinedSummaries,
} as const;

/** Shape returned by the Reduce LLM call. */
export interface LessonReduceResult {
    summary: string;
    suggestedTitle: string;
}
