/**
 * Prompts used by SummaryService for Map-Reduce summarization.
 *
 * These prompts are optimized for:
 * - Reducing hallucinations
 * - Enforcing strict JSON output in Reduce step
 * - Ensuring factual consistency
 * - Production-grade stability
 */

export const SummaryPrompts = {
    /**
     * MAP step – summarise a single chunk of a lesson transcript.
     * Output: 2–3 concise sentences in Vietnamese.
     */
    chunkSystem: () =>
        'You are an expert at summarizing educational video transcripts. ' +
        'Summaries must be concise, factually accurate, and based ONLY on the provided text. ' +
        'Do NOT add external knowledge, assumptions, examples, or interpretations. ' +
        'Avoid repetition. ' +
        'Always respond in Vietnamese.',

    chunkHuman: (content: string) =>
        'Tóm tắt đoạn transcript sau trong đúng 2-3 câu ngắn gọn (không quá 80 từ). ' +
        'Chỉ bao gồm các khái niệm hoặc ý chính được đề cập trực tiếp trong nội dung. ' +
        'Không suy diễn hoặc thêm thông tin ngoài văn bản.\n\n' +
        '--- BEGIN TRANSCRIPT ---\n' +
        content +
        '\n--- END TRANSCRIPT ---',

    /**
     * REDUCE step – synthesise N chunk summaries into:
     * {
     *   summary: string;
     *   suggestedTitle: string;
     * }
     *
     * Must return strictly valid JSON.
     */
    lessonSystem: () =>
        'You are an expert educational content summarizer. ' +
        'Always respond in Vietnamese. ' +
        'You MUST respond with a strictly valid JSON object only. ' +
        'Do NOT include markdown, code fences, comments, explanations, or extra text. ' +
        'The response must be directly parseable JSON. ' +
        'Do not include trailing commas.',

    lessonHuman: (combinedSummaries: string) =>
        'Dưới đây là các tóm tắt của từng phần trong một bài học giáo dục.\n\n' +
        'Dựa HOÀN TOÀN trên các nội dung bên dưới (không thêm kiến thức ngoài nội dung đã cung cấp), ' +
        'hãy trả về một JSON object với đúng hai trường:\n\n' +
        '1. "summary": Tóm tắt toàn diện bài học trong 4-5 câu tiếng Việt (không quá 150 từ), ' +
        'bao gồm các chủ đề chính và kết quả học tập quan trọng.\n\n' +
        '2. "suggestedTitle": Tiêu đề ngắn gọn, hấp dẫn bằng tiếng Việt (tối đa 10 từ), ' +
        'phản ánh chủ đề cốt lõi của bài học.\n\n' +
        'Nếu thông tin chưa đầy đủ, vẫn phải trả về JSON hợp lệ dựa trên nội dung hiện có.\n\n' +
        '--- BEGIN PARTIAL SUMMARIES ---\n' +
        combinedSummaries +
        '\n--- END PARTIAL SUMMARIES ---',
} as const;

/** Shape returned by the Reduce LLM call. */
export interface LessonReduceResult {
    summary: string;
    suggestedTitle: string;
}