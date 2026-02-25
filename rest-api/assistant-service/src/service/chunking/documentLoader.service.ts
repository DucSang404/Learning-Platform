
import { readFile } from "fs/promises";

/**
 * Service class for loading documents from various file formats.
 */
export class DocumentLoader {
    /**
     * Asynchronously loads a text file and returns its content as a string.
     *
     * This function uses Node.js's native fs/promises to read the file content.
     *
     * @param {string} relativePath - The relative path to the text file that needs to be loaded.
     * @returns {Promise<string>} A promise that resolves with the content of the text file as a string.
     */
    async loadTextFile(relativePath: string): Promise<string> {
        const textCorpus = await readFile(relativePath, "utf-8");
        return textCorpus;
    }
}
