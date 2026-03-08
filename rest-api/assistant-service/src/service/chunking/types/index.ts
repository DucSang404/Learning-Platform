
export interface SubtitleMetadata {
    subtitleIndex?: number;
    startTime?: string;
    endTime?: string;
    timestamp?: string;
}

export interface SentenceObject {
    sentence: string;
    index: number;
    combined_sentence?: string;
    combined_sentence_embedding?: number[];
    distance_to_next?: number;
    metadata?: SubtitleMetadata;
}

export interface SemanticChunk {
    content: string;
    metadata?: {
        subtitleIndex?: number;      // Index of the first subtitle in the chunk
        startTime?: string;           // Start time of the first subtitle
        endTime?: string;             // End time of the last subtitle
        timestamp?: string;           // Full timestamp from start to end
        sentenceCount?: number;       // Number of sentences in the chunk
        startSentenceIndex?: number;  // Index of the first sentence in the chunk
        endSentenceIndex?: number;    // Index of the last sentence in the chunk
    };
}
