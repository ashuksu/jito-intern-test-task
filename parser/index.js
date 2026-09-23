import {tokenize} from "./tokenizer.js";
import {buildTree} from "./tree-builder.js";

export function parseHtml(htmlText) {
    const tokens = tokenize(htmlText);

    return buildTree(tokens);
}