
import { DocumentLoader } from "~/service/chunking/DocumentLoader";
import { SentenceProcessor } from "~/service/chunking/SentenceProcessor";
import { EmbeddingService } from "~/service/chunking/EmbeddingService";
import { SemanticAnalyzer } from "~/service/chunking/SemanticAnalyzer";
import { SemanticChunk } from "~/service/chunking/types";

/**
 * Configuration options for semantic chunking.
 */
export interface SemanticChunkingConfig {
    bufferSize?: number;
    percentileThreshold?: number;
    chunkSize?: number;
    chunkOverlap?: number;
}

/**
 * Main service orchestrating the semantic chunking process.
 * This service coordinates the document loading, sentence processing, embedding generation,
 * and semantic analysis to create meaningful chunks from text.
 */
export class SemanticChunkingService {
    private documentLoader: DocumentLoader;
    private sentenceProcessor: SentenceProcessor;
    private embeddingService: EmbeddingService;
    private semanticAnalyzer: SemanticAnalyzer;

    constructor() {
        this.documentLoader = new DocumentLoader();
        this.sentenceProcessor = new SentenceProcessor();
        this.embeddingService = new EmbeddingService();
        this.semanticAnalyzer = new SemanticAnalyzer();
    }

    /**
     * Processes a text file and returns semantic chunks with metadata.
     *
     * @param {string} filePath - Path to the text file to process.
     * @param {SemanticChunkingConfig} config - Configuration options for chunking.
     * @returns {Promise<SemanticChunk[]>} Array of semantic chunks with content and metadata.
     */
    async processTextFile(
        filePath: string,
        config: SemanticChunkingConfig = {}
    ): Promise<SemanticChunk[]> {
        const {
            bufferSize = 1,
            percentileThreshold = 80,
        } = config;

        // Step 1: Load the text file
        const textCorpus = await this.documentLoader.loadTextFile(filePath);

        // Step 2: Check if subtitle format and structure accordingly
        const structuredSentences = this.sentenceProcessor.structureSubtitles(
            textCorpus,
            bufferSize
        );

        // Step 3: Generate embeddings for these combined sentences
        const sentencesWithEmbeddings =
            await this.embeddingService.generateAndAttachEmbeddings(
                structuredSentences
            );

        // Step 5: Calculate cosine distances and significant shifts to identify semantic chunks
        const { updatedArray, significantShiftIndices } =
            this.semanticAnalyzer.calculateCosineDistancesAndSignificantShifts(
                sentencesWithEmbeddings,
                percentileThreshold
            );

        // Step 6: Group sentences into semantic chunks based on the significant shifts identified
        const semanticChunks = this.semanticAnalyzer.groupSentencesIntoChunks(
            updatedArray,
            significantShiftIndices
        );

        return semanticChunks;
    }

    /**
   * Logs semantic chunks with formatting.
   *
   * @param {SemanticChunk[]} semanticChunks - Array of semantic chunks to log.
   */
    logSemanticChunks(semanticChunks: SemanticChunk[]): void {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Total Chunks Processed: ${semanticChunks.length}`);
        console.log(`${'='.repeat(80)}\n`);

        semanticChunks.forEach((chunk, index) => {
            console.log(`\n${'-'.repeat(80)}`);
            console.log(`Chunk #${index + 1}`);
            console.log(`${'-'.repeat(80)}`);

            if (chunk.metadata) {
                console.log(`\n📊 Metadata:`);
                if (chunk.metadata.timestamp) {
                    console.log(`  ⏱️  Timestamp: ${chunk.metadata.timestamp}`);
                }
                if (chunk.metadata.subtitleIndex !== undefined) {
                    console.log(`  🔢 Subtitle Index: ${chunk.metadata.subtitleIndex}`);
                }
                if (chunk.metadata.sentenceCount) {
                    console.log(`  📝 Sentences: ${chunk.metadata.sentenceCount}`);
                }
            }

            console.log(`\n📄 Content:`);
            console.log(chunk.content);
            console.log();
        });

        console.log(`\n${'='.repeat(80)}\n`);
    }
}
