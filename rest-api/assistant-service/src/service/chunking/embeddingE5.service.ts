import { OpenAIEmbeddings } from "@langchain/openai";
import { SentenceObject } from "./types";

/**
 * Service class for generating and attaching embeddings to sentences using local e5-base-v2 model.
 */
export class EmbeddingE5Service {
    private embeddings: OpenAIEmbeddings;

    constructor() {
        this.embeddings = new OpenAIEmbeddings({
            modelName: "intfloat/e5-base-v2",
            openAIApiKey: process.env.EMBEDDING_API_KEY || "dummy-key",
            configuration: {
                baseURL: process.env.EMBEDDING_API_URL || "http://localhost:37621/v1",
            },
        });
    }

    /**
     * Generates embeddings for combined sentences within a new array of SentenceObject items.
     * Uses the local e5-base-v2 model which requires the "passage: " prefix for document embeddings.
     *
     * @param {SentenceObject[]} sentencesArray - An array of SentenceObject items.
     * @returns {Promise<SentenceObject[]>} A promise that resolves with a new array of SentenceObject items.
     */
    async generateAndAttachEmbeddings(
        sentencesArray: SentenceObject[]
    ): Promise<SentenceObject[]> {
        // Deep copy the sentencesArray to ensure purity
        const sentencesArrayCopy: SentenceObject[] = sentencesArray.map(
            (sentenceObject) => ({
                ...sentenceObject,
                combined_sentence_embedding: sentenceObject.combined_sentence_embedding
                    ? [...sentenceObject.combined_sentence_embedding]
                    : undefined,
            })
        );

        // Extract combined sentences for embedding
        // Note: intfloat/e5-base-v2 expects "passage: " prefix for indexing documents.
        const combinedSentencesStrings: string[] = sentencesArrayCopy
            .filter((item) => item.combined_sentence !== undefined)
            // Adding prefix specifically for e5 model best practices
            .map((item) => `passage: ${item.combined_sentence}`);

        if (combinedSentencesStrings.length === 0) {
            return sentencesArrayCopy;
        }

        // Generate embeddings for the combined sentences in batches of 32
        const BATCH_SIZE = 32;
        const embeddingsArray: number[][] = [];

        for (let i = 0; i < combinedSentencesStrings.length; i += BATCH_SIZE) {
            const batch = combinedSentencesStrings.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await this.embeddings.embedDocuments(batch);
            embeddingsArray.push(...batchEmbeddings);
        }

        // Attach embeddings to the corresponding SentenceObject in the copied array
        let embeddingIndex = 0;
        for (let i = 0; i < sentencesArrayCopy.length; i++) {
            if (sentencesArrayCopy[i].combined_sentence !== undefined) {
                sentencesArrayCopy[i].combined_sentence_embedding =
                    embeddingsArray[embeddingIndex++];
            }
        }

        return sentencesArrayCopy;
    }
}
