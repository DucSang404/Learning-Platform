
import { DocumentLoader } from "~/service/chunking/documentLoader.service";
import { SentenceProcessor } from "~/service/chunking/sentenceProcessor.service";
import { EmbeddingE5Service } from "~/service/chunking/embeddingE5.service";
import { SemanticAnalyzer } from "~/service/chunking/semanticAnalyzer.service";
import { SemanticChunk } from "~/service/chunking/types";

/**
 * Configuration options for semantic chunking.
 */
export interface SemanticChunkingConfig {
    bufferSize?: number;
    percentileThreshold?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    /**
     * Whether the input is in SRT subtitle format.
     * - `true`  (default) → uses `structureSubtitles()` which preserves timestamp metadata.
     * - `false`           → uses NLP sentence tokenizer + `structureSentences()` for plain text.
     */
    isSrt?: boolean;
}

/**
 * Main service orchestrating the semantic chunking process.
 * This service coordinates the document loading, sentence processing, embedding generation,
 * and semantic analysis to create meaningful chunks from text.
 */
export class SemanticChunkingService {
    private documentLoader: DocumentLoader;
    private sentenceProcessor: SentenceProcessor;
    private embeddingService: EmbeddingE5Service;
    private semanticAnalyzer: SemanticAnalyzer;

    constructor() {
        this.documentLoader = new DocumentLoader();
        this.sentenceProcessor = new SentenceProcessor();
        this.embeddingService = new EmbeddingE5Service();
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
        const textCorpus = await this.documentLoader.loadTextFile(filePath);
        return this.processRawText(textCorpus, config);
    }

    /**
     * Processes a raw text / SRT string and returns semantic chunks with metadata.
     * Use this when the content is already in memory (e.g. fetched from AssemblyAI)
     * so there is no need to write a temporary file first.
     *
     * @param {string} rawText - Raw SRT or plain-text content to chunk.
     * @param {SemanticChunkingConfig} config - Configuration options for chunking.
     * @returns {Promise<SemanticChunk[]>} Array of semantic chunks with content and metadata.
     */
    async processRawText(
        rawText: string,
        config: SemanticChunkingConfig = {}
    ): Promise<SemanticChunk[]> {
        const {
            bufferSize = 3,
            percentileThreshold = 95,
            isSrt = true,
        } = config;

        // Step 1: Structure sentences from raw text.
        //   - SRT path:       structureSubtitles()   → preserves timestamp / subtitle metadata
        //   - Plain text path: NLP tokenize → structureSentences() → no extra metadata
        const structuredSentences = isSrt
            ? this.sentenceProcessor.structureSubtitles(rawText, bufferSize)
            : this.sentenceProcessor.structureSentences(
                this.sentenceProcessor.splitToSentencesUsingNLP(rawText),
                bufferSize
            );

        // Step 2: Generate embeddings for combined sentences
        const sentencesWithEmbeddings =
            await this.embeddingService.generateAndAttachEmbeddings(
                structuredSentences
            );

        // Step 3: Calculate cosine distances and detect significant semantic shifts
        const { updatedArray, significantShiftIndices } =
            this.semanticAnalyzer.calculateCosineDistancesAndSignificantShifts(
                sentencesWithEmbeddings,
                percentileThreshold
            );

        // Step 4: Group sentences into semantic chunks based on the detected shifts
        const semanticChunks = this.semanticAnalyzer.groupSentencesIntoChunks(
            updatedArray,
            significantShiftIndices
        );

        this.logSemanticChunks(semanticChunks);

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
