import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import Logger from '~/utils/logger';
import { env } from '~/config/env';
import prismaService from '~/service/utils/prisma.service';
import { LessonChunk } from '@prisma/client';
import { SummaryPrompts } from '~/prompts/summary.prompt';

/**
 * SummaryService implements Map–Reduce Summarization for lesson content.
 *
 * Flow:
 *   1. MAP   – Summarize each LessonChunk individually → save to LessonChunk.summary
 *   2. REDUCE – Combine N chunk summaries → generate final lesson summary → save to Lesson.summary
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
        });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Runs the full Map–Reduce summarization pipeline for a lesson.
     *
     * @param lessonId - The lesson whose chunks should be summarised.
     * @returns The final lesson-level summary string.
     */
    public async summarizeLesson(lessonId: string): Promise<string> {
        Logger.info(`[SummaryService] Starting Map-Reduce for lessonId=${lessonId}`);

        // Fetch all chunks for this lesson ordered by position
        const chunks = await prismaService.lessonChunk.findMany({
            where: { lessonId },
            orderBy: { chunkIndex: 'asc' },
        });

        if (chunks.length === 0) {
            Logger.warn(`[SummaryService] No chunks found for lessonId=${lessonId}, skipping.`);
            return '';
        }

        Logger.info(`[SummaryService] MAP step – summarising ${chunks.length} chunk(s)`);

        // Step 1 – MAP: summarise each chunk in batches
        const chunkSummaries = await this.mapChunks(chunks);

        Logger.info(`[SummaryService] REDUCE step – synthesising ${chunkSummaries.length} summaries`);

        // Step 2 – REDUCE: combine chunk summaries into one lesson summary
        const lessonSummary = await this.reduceToLessonSummary(chunkSummaries);

        // Persist the final summary onto the Lesson record
        await prismaService.lesson.update({
            where: { id: lessonId },
            data: { summary: lessonSummary },
        });

        Logger.info(`[SummaryService] Lesson summary saved for lessonId=${lessonId}`);

        return lessonSummary;
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
     * Summarises a single chunk and persists the result to `LessonChunk.summary`.
     */
    private async summarizeChunk(chunk: LessonChunk): Promise<string> {
        const messages = [
            new SystemMessage(SummaryPrompts.chunkSystem()),
            new HumanMessage(SummaryPrompts.chunkHuman(chunk.content)),
        ];

        const response = await this.llm.invoke(messages);
        const summary = (response.content as string).trim();

        // Persist chunk-level summary (Map step result)
        await prismaService.lessonChunk.update({
            where: { id: chunk.id },
            data: { summary },
        });

        Logger.info(
            `[SummaryService] MAP – chunk ${chunk.chunkIndex} summarised (chunkId=${chunk.id})`
        );

        return summary;
    }

    /**
     * REDUCE step – takes all chunk summaries and produces one coherent lesson summary.
     */
    private async reduceToLessonSummary(chunkSummaries: string[]): Promise<string> {
        const combinedSummaries = chunkSummaries
            .map((s, i) => `Section ${i + 1}: ${s}`)
            .join('\n\n');

        const messages = [
            new SystemMessage(SummaryPrompts.lessonSystem()),
            new HumanMessage(SummaryPrompts.lessonHuman(combinedSummaries)),
        ];

        const response = await this.llm.invoke(messages);
        return (response.content as string).trim();
    }
}
