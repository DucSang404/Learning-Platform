import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import Logger from '~/utils/logger';
import { env } from '~/config/env';
import prismaService from '~/service/utils/prisma.service';
import { LessonChunk } from '@prisma/client';
import { LessonReduceResult, ChunkReduceResult, SummaryPrompts } from '~/prompts/summary.prompt';

/**
 * SummaryService implements Map–Reduce Summarization for lesson content.
 *
 * Flow:
 *   1. MAP    – Summarize each LessonChunk individually → save to LessonChunk.summary
 *   2. REDUCE – Combine N chunk summaries → generate lesson summary + suggestedTitle → save to Lesson
 */
export class SummaryService {
    private llm: ChatOpenAI;

    /** Max concurrent OpenAI calls during the Map step */
    private static readonly MAP_CONCURRENCY = 5;

    constructor() {
        this.llm = new ChatOpenAI({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            apiKey: env.OPENAI_API_KEY,
            maxTokens: 500,
        });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Runs the full Map–Reduce summarization pipeline for a lesson.
     *
     * @param lessonId - The lesson whose chunks should be summarised.
     */
    public async summarizeLesson(lessonId: string): Promise<void> {
        Logger.info(`[SummaryService] Starting Map-Reduce for lessonId=${lessonId}`);

        // Fetch all chunks for this lesson ordered by position
        const chunks = await prismaService.lessonChunk.findMany({
            where: { lessonId },
            orderBy: { chunkIndex: 'asc' },
        });

        if (chunks.length === 0) {
            Logger.warn(`[SummaryService] No chunks found for lessonId=${lessonId}, skipping.`);
            return;
        }

        Logger.info(`[SummaryService] MAP step – summarising ${chunks.length} chunk(s)`);

        // Step 1 – MAP: summarise each chunk in batches
        const chunkSummaries = await this.mapChunks(chunks);

        Logger.info(`[SummaryService] REDUCE step – synthesising ${chunkSummaries.length} summaries`);

        // Step 2 – REDUCE: combine chunk summaries → lesson summary + suggestedTitle
        const { summary, suggestedTitle } = await this.reduceToLessonSummary(chunkSummaries);

        // Persist both fields onto the Lesson record in a single DB call
        await prismaService.lesson.update({
            where: { id: lessonId },
            data: { summary, suggestedTitle },
        });

        Logger.info(
            `[SummaryService] Saved summary + suggestedTitle="${suggestedTitle}" for lessonId=${lessonId}`
        );
    }

    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------

    /**
     * MAP step – summarises each chunk concurrently (bounded by MAP_CONCURRENCY).
     * Persists each chunk's summary back to the DB.
     */
    private async mapChunks(chunks: LessonChunk[]): Promise<string[]> {
        const results: string[] = [];

        // Process in batches to avoid rate-limit spikes
        for (let i = 0; i < chunks.length; i += SummaryService.MAP_CONCURRENCY) {
            const batch = chunks.slice(i, i + SummaryService.MAP_CONCURRENCY);

            const batchSummaries = await Promise.all(
                batch.map((chunk) => this.summarizeChunk(chunk))
            );

            results.push(...batchSummaries);
        }

        return results;
    }

    /**
     * Summarises a single chunk and persists the result to `LessonChunk.title` and `LessonChunk.summary`.
     * Returns a combined string for the REDUCE step: "Title: [title]\nSummary: [summary]"
     */
    private async summarizeChunk(chunk: LessonChunk): Promise<string> {
        const messages = [
            new SystemMessage(SummaryPrompts.chunkSystem()),
            new HumanMessage(SummaryPrompts.chunkHuman(chunk.content)),
        ];

        const response = await this.llm.invoke(messages);
        const raw = (response.content as string).trim();

        let title = '';
        let summary = raw; // Default fallback to raw text

        try {
            const parsed: ChunkReduceResult = JSON.parse(raw);
            title = parsed.title?.trim() ?? '';
            summary = parsed.summary?.trim() ?? summary;
        } catch {
            Logger.warn(`[SummaryService] MAP – failed to parse JSON for chunkId=${chunk.id}, using raw text`);
        }

        // Persist chunk-level title and summary (Map step result)
        await prismaService.lessonChunk.update({
            where: { id: chunk.id },
            data: { title, summary },
        });

        Logger.info(
            `[SummaryService] MAP – chunk ${chunk.chunkIndex} summarised (chunkId=${chunk.id})`
        );

        // Return a combined string so the REDUCE step has context of both the title and the summary of the chunk
        return `Title: ${title}\nSummary: ${summary}`;
    }

    /**
     * REDUCE step – takes all chunk summaries and produces:
     *   - `summary`        : comprehensive lesson overview (4-5 sentences)
     *   - `suggestedTitle` : short, engaging lesson title (max 10 words)
     *
     * The LLM is prompted to return a JSON object so both values
     * are obtained in a single API call.
     */
    private async reduceToLessonSummary(chunkSummaries: string[]): Promise<LessonReduceResult> {
        const combinedSummaries = chunkSummaries
            .map((s, i) => `Section ${i + 1}: ${s}`)
            .join('\n\n');

        const messages = [
            new SystemMessage(SummaryPrompts.lessonSystem()),
            new HumanMessage(SummaryPrompts.lessonHuman(combinedSummaries)),
        ];

        const response = await this.llm.invoke(messages);
        const raw = (response.content as string).trim();

        try {
            const parsed: LessonReduceResult = JSON.parse(raw);
            return {
                summary: parsed.summary?.trim() ?? '',
                suggestedTitle: parsed.suggestedTitle?.trim() ?? '',
            };
        } catch {
            // Graceful fallback: treat the entire response as the summary
            Logger.warn('[SummaryService] REDUCE – failed to parse JSON response, using raw text as summary');
            return { summary: raw, suggestedTitle: '' };
        }
    }
}
