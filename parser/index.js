import {tokenize} from "./tokenizer.js";
import {buildTree} from "./tree-builder.js";

/**
 * Converts HTML string to AST JSON object.
 * @param {string} htmlText
 * @returns {Array<Object>}
 */
export function parseHtml(htmlText) {
    if (typeof htmlText !== "string") {
        return [];
    }
    const tokens = tokenize(htmlText);

    return buildTree(tokens);
}