
import * as natural from "natural";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SentenceObject } from "./types";
import { SubtitleParser } from "../../utils/SubtitleParser";

/**
 * Service class for processing text into sentences.
 */
export class SentenceProcessor {
    /**
     * Splits a given text corpus into an array of sentences using NLP.
     * Automatically detects and parses subtitle format if present.
     *
     * This function utilizes `natural.SentenceTokenizer` to tokenize the provided text corpus
     * into individual sentences. It's designed to accurately recognize sentence boundaries
     * and split the text accordingly. The tokenizer's efficiency and accuracy in identifying
     * sentence endings allow for reliable sentence segmentation, which is crucial for
     * text processing tasks that require sentence-level analysis.
     *
     * If the input is in SRT subtitle format, it will parse and extract only the content text.
     *
     * @param {string} textCorpus - The text corpus to be split into sentences.
     * @returns {string[]} An array of sentences extracted from the text corpus.
     *
     * @example
     * const text = "Hello world. This is a test text.";
     * const processor = new SentenceProcessor();
     * const sentences = processor.splitToSentencesUsingNLP(text);
     * console.log(sentences); // Output: ["Hello world.", "This is a test text."]
     */
    splitToSentencesUsingNLP(textCorpus: string): string[] {
        // Check if this is subtitle format
        if (SubtitleParser.isSubtitleFormat(textCorpus)) {
            const parsedSubtitles = SubtitleParser.parseSubtitles(textCorpus);
            return parsedSubtitles.map(sub => sub.content);
        }

        // Note: Natural 8.x has incorrect type definitions - the constructor actually accepts optional parameters
        const tokenizer = new (natural.SentenceTokenizer as any)([]);
        const sentences = tokenizer.tokenize(textCorpus);
        return sentences;
    }

    /**
     * Parse subtitle format and return structured data with metadata.
     * 
     * @param {string} textCorpus - The subtitle text corpus
     * @returns {Array} Array of parsed subtitles with content and metadata
     */
    parseSubtitles(textCorpus: string) {
        return SubtitleParser.parseSubtitles(textCorpus);
    }

    /**
     * Splits text into sentences using RecursiveCharacterTextSplitter.
     *
     * @param {string} textCorpus - The text corpus to be split.
     * @param {number} chunkSize - The maximum size of each chunk.
     * @param {number} chunkOverlap - The overlap between chunks.
     * @returns {Promise<string[]>} A promise that resolves with an array of sentences.
     */
    async splitToSentences(
        textCorpus: string,
        chunkSize: number = 200,
        chunkOverlap: number = 20
    ): Promise<string[]> {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
        });

        const output = await splitter.createDocuments([textCorpus]);

        return output.map((out: { pageContent: string }) => out.pageContent);
    }

    /**
     * Structures an array of sentences into an array of `SentenceObject`s, each enhanced with combined sentences based on a specified buffer size.
     *
     * This function iterates through each sentence in the input array, creating an object for each that includes the original sentence, its index, and a combined sentence. The combined sentence is constructed by concatenating neighboring sentences within a specified range (bufferSize) before and after the current sentence, facilitating contextual analysis or embeddings in subsequent processing steps.
     *
     * The `bufferSize` determines how many sentences before and after the current sentence are included in the `combined_sentence`. For example, with a `bufferSize` of 1, each `combined_sentence` will include the sentence itself, the one preceding it, and the one following it, as long as such sentences exist.
     *
     * @param {string[]} sentences - An array of sentences to be structured.
     * @param {number} [bufferSize=1] - The number of sentences to include before and after the current sentence when forming the combined sentence. Defaults to 1.
     * @returns {SentenceObject[]} An array of `SentenceObject`s, each containing the original sentence, its index, and a combined sentence that includes its neighboring sentences based on the specified `bufferSize`.
     *
     * @example
     * const sentences = ["Sentence one.", "Sentence two.", "Sentence three."];
     * const processor = new SentenceProcessor();
     * const structuredSentences = processor.structureSentences(sentences, 1);
     * console.log(structuredSentences);
     * // Output: [
     * //   { sentence: 'Sentence one.', index: 0, combined_sentence: 'Sentence one. Sentence two.' },
     * //   { sentence: 'Sentence two.', index: 1, combined_sentence: 'Sentence one. Sentence two. Sentence three.' },
     * //   { sentence: 'Sentence three.', index: 2, combined_sentence: 'Sentence two. Sentence three.' }
     * // ]
     */
    structureSentences(
        sentences: string[],
        bufferSize: number = 1
    ): SentenceObject[] {
        const sentenceObjectArray: SentenceObject[] = sentences.map(
            (sentence, i) => ({
                sentence,
                index: i,
            })
        );

        sentenceObjectArray.forEach((currentSentenceObject, i) => {
            let combinedSentence = "";

            for (let j = i - bufferSize; j < i; j++) {
                if (j >= 0) {
                    combinedSentence += sentenceObjectArray[j].sentence + " ";
                }
            }

            combinedSentence += currentSentenceObject.sentence + " ";

            for (let j = i + 1; j <= i + bufferSize; j++) {
                if (j < sentenceObjectArray.length) {
                    combinedSentence += sentenceObjectArray[j].sentence;
                }
            }

            sentenceObjectArray[i].combined_sentence = combinedSentence.trim();
        });

        return sentenceObjectArray;
    }

    /**
     * Structure subtitles with metadata preserved.
     * 
     * @param {string} textCorpus - Raw subtitle text
     * @param {number} bufferSize - Buffer size for context window
     * @returns {SentenceObject[]} Structured sentences with metadata
     */
    structureSubtitles(
        textCorpus: string,
        bufferSize: number = 1
    ): SentenceObject[] {
        const parsedSubtitles = SubtitleParser.parseSubtitles(textCorpus);

        const sentenceObjectArray: SentenceObject[] = parsedSubtitles.map(
            (subtitle, i) => ({
                sentence: subtitle.content,
                index: i,
                metadata: subtitle.metadata,
            })
        );

        sentenceObjectArray.forEach((currentSentenceObject, i) => {
            let combinedSentence = "";

            for (let j = i - bufferSize; j < i; j++) {
                if (j >= 0) {
                    combinedSentence += sentenceObjectArray[j].sentence + " ";
                }
            }

            combinedSentence += currentSentenceObject.sentence + " ";

            for (let j = i + 1; j <= i + bufferSize; j++) {
                if (j < sentenceObjectArray.length) {
                    combinedSentence += sentenceObjectArray[j].sentence;
                }
            }

            sentenceObjectArray[i].combined_sentence = combinedSentence.trim();
        });

        return sentenceObjectArray;
    }
}
