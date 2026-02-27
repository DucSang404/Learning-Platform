
import { SubtitleMetadata } from "~/service/chunking/types";

export interface ParsedSubtitle {
    content: string;
    metadata: SubtitleMetadata;
}

/**
 * Utility class for parsing subtitle files (SRT format).
 */
export class SubtitleParser {
    /**
     * Parse SRT subtitle format and extract content with metadata.
     * 
     * Example input:
     * ```
     * 17
     * 00:01:02,335 --> 00:01:06,215
     * tới ERP và hệ thống kế toán mà nó có phần mềm chỉ Windows Form thì
     * ```
     * 
     * @param textCorpus - Raw subtitle text
     * @returns Array of parsed subtitles with content and metadata
     */
    static parseSubtitles(textCorpus: string): ParsedSubtitle[] {
        const subtitles: ParsedSubtitle[] = [];

        // Split by double newline to get individual subtitle blocks
        const blocks = textCorpus.split(/\n\s*\n/).filter(block => block.trim());

        for (const block of blocks) {
            const lines = block.split('\n').map(line => line.trim()).filter(line => line);

            if (lines.length < 2) continue;

            // First line: subtitle index (number)
            const subtitleIndex = parseInt(lines[0]);

            // Second line: timestamp (00:01:02,335 --> 00:01:06,215)
            const timestampMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

            if (!timestampMatch) {
                // Not a valid subtitle format, skip
                continue;
            }

            const startTime = timestampMatch[1];
            const endTime = timestampMatch[2];
            const timestamp = lines[1];

            // Remaining lines: actual content
            const content = lines.slice(2).join(' ');

            if (content && !isNaN(subtitleIndex)) {
                subtitles.push({
                    content: content.trim(),
                    metadata: {
                        subtitleIndex,
                        startTime,
                        endTime,
                        timestamp
                    }
                });
            }
        }

        return subtitles;
    }

    /**
     * Check if the text appears to be in SRT subtitle format.
     */
    static isSubtitleFormat(textCorpus: string): boolean {
        // Check for SRT timestamp pattern
        const timestampPattern = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
        return timestampPattern.test(textCorpus);
    }
}
