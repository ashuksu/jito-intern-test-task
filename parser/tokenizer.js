/**
 * @file HTML Tokenizer
 * Converts raw HTML string into a stream of structured tokens.
 */

/** @type {Set<string>} HTML5 void elements that cannot contain child nodes or closing tags. */
const VOID_ELEMENTS = new Set([
    "meta",
    "link",
    "img",
    "input",
    "br",
    "hr",
    "source",
    "base",
    "col",
    "track",
    "wbr",
    "area",
    "embed",
    "param",
]);

/** @type {Set<string>} Elements whose content is parsed as raw text instead of HTML markup. */
const RAWTEXT_ELEMENTS = new Set([
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
]);

/** @type {number} Maximum input length in characters before tokenizer throws an error. */
const MAX_INPUT_LENGTH = 5_000_000; // 5 МБ

/**
 * Tokenizes an HTML string into a flat token stream.
 * @param {string} htmlText - Source HTML text.
 * @returns {Array<Object>} List of parsed tokens.
 */
export function tokenize(htmlText) {
    if (htmlText.length > MAX_INPUT_LENGTH) {
        return [{
            "type": "text", "value": `Input too large: ${htmlText.length} chars`
        }]
    }

    const tokens = [];
    let index = 0;

    while (index < htmlText.length) {
        if (htmlText[index] !== "<") {
            const result = readText(htmlText, index);

            tokens.push({
                type: "text",
                value: result.value,
            });

            index = result.nextIndex;
            continue;
        }

        if (htmlText.startsWith("<!--", index)) {
            const commentResult = readComment(htmlText, index);

            tokens.push(commentResult.token);
            index = commentResult.nextIndex;
            continue;
        }

        if (htmlText[index + 1] === "?") {
            const piResult = readProcessingInstruction(htmlText, index);

            tokens.push(piResult.token);
            index = piResult.nextIndex;
            continue;
        }

        if (htmlText.slice(index, index + 9).toLowerCase() === "<!doctype") {
            const nextChar = htmlText[index + 9];

            if (!nextChar || /[\s>]/.test(nextChar)) {
                const doctypeResult = readDoctype(htmlText, index);

                tokens.push(doctypeResult.token);
                index = doctypeResult.nextIndex;
                continue;
            }
        }

        if (htmlText[index + 1] === "/") {
            const closingResult = readClosingTag(htmlText, index);
            if (closingResult) {
                tokens.push(closingResult.token);
                index = closingResult.nextIndex;
                continue;
            }
        }

        const tagResult = readStartTag(htmlText, index);
        tokens.push(tagResult.token);
        index = tagResult.nextIndex;

        if (
            tagResult.token.type === "startTag" &&
            RAWTEXT_ELEMENTS.has(tagResult.token.tagName.toLowerCase()) &&
            !tagResult.token.isSelfClosing
        ) {
            const rawTextResult = readRawText(
                htmlText,
                index,
                tagResult.token.tagName
            );

            if (rawTextResult.value) {
                tokens.push({
                    type: "text",
                    value: rawTextResult.value,
                });
            }

            index = rawTextResult.nextIndex;
        }
    }

    return tokens;
}

/**
 * Reads literal text up to the next opening bracket '<'.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ value: string, nextIndex: number }}
 */
function readText(htmlText, startIndex) {
    let index = startIndex;

    while (index < htmlText.length && htmlText[index] !== "<") {
        index++;
    }

    return {
        value: htmlText.slice(startIndex, index),
        nextIndex: index,
    };
}

/**
 * Attempts to parse an end tag (`</tagName>`).
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ token: Object, nextIndex: number } | null} Token payload and next offset, or null if syntax is invalid.
 */
function readClosingTag(htmlText, startIndex) {
    if (htmlText[startIndex] !== "<" || htmlText[startIndex + 1] !== "/") {
        return null;
    }

    let index = startIndex + 2;

    if (index >= htmlText.length || !/[a-zA-Z]/.test(htmlText[index])) {
        return null;
    }

    const nameStart = index;

    while (index < htmlText.length && /[a-zA-Z0-9-]/.test(htmlText[index])) {
        index++;
    }

    const tagName = htmlText.slice(nameStart, index);

    if (htmlText[index] !== ">" && !/\s/.test(htmlText[index])) {
        return null;
    }

    while (index < htmlText.length && /\s/.test(htmlText[index])) {
        index++;
    }

    if (htmlText[index] !== ">") {
        return null;
    }

    return {
        token: {
            type: "endTag",
            tagName,
        },
        nextIndex: index + 1,
    };
}

/**
 * Parses a start tag (`<tagName ...>`), attributes, and determines self-closing status.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ token: Object, nextIndex: number }}
 */
function readStartTag(htmlText, startIndex) {
    let index = startIndex + 1;

    if (!/[a-zA-Z]/.test(htmlText[index])) {
        return {
            token: {type: "text", value: "<"},
            nextIndex: startIndex + 1,
        };
    }

    const nameStart = index;

    while (index < htmlText.length && /[a-zA-Z0-9-]/.test(htmlText[index])) {
        index++;
    }

    const tagName = htmlText.slice(nameStart, index);

    if (
        htmlText[index] !== ">" &&
        !/\s/.test(htmlText[index]) &&
        htmlText[index] !== "/"
    ) {
        return {
            token: {type: "text", value: "<"},
            nextIndex: startIndex + 1,
        };
    }

    const {attributes, isSelfClosing, nextIndex} = readAttributes(
        htmlText,
        index
    );

    let finalIndex = nextIndex;

    if (htmlText[finalIndex] === ">") {
        finalIndex++;
    }

    return {
        token: {
            type: "startTag",
            tagName,
            attributes,
            isSelfClosing: isSelfClosing || VOID_ELEMENTS.has(tagName.toLowerCase()),
        },
        nextIndex: finalIndex,
    };
}

/**
 * Extracts key-value attribute pairs and detects self-closing slash markers.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ attributes: Array<Object>, isSelfClosing: boolean, nextIndex: number }}
 */
function readAttributes(htmlText, startIndex) {
    const attributes = [];
    let index = startIndex;
    let isSelfClosing = false;

    while (index < htmlText.length) {
        while (index < htmlText.length && /\s/.test(htmlText[index])) {
            index++;
        }

        if (index >= htmlText.length || htmlText[index] === ">") {
            break;
        }

        if (htmlText[index] === "/") {
            let testIndex = index;

            while (
                testIndex < htmlText.length &&
                (htmlText[testIndex] === "/" || /\s/.test(htmlText[testIndex]))
                ) {
                testIndex++;
            }

            if (htmlText[testIndex] === ">") {
                isSelfClosing = true;
                index = testIndex;
                break;
            }

            index++;
            continue;
        }

        if (htmlText[index] === "<") {
            break;
        }

        const nameStart = index;

        while (
            index < htmlText.length &&
            !/[\s=>/]/.test(htmlText[index])
            ) {
            index++;
        }

        const name = htmlText.slice(nameStart, index);

        if (!name) {
            index++;
            continue;
        }

        while (index < htmlText.length && /\s/.test(htmlText[index])) {
            index++;
        }

        if (htmlText[index] !== "=") {
            attributes.push({
                name,
                value: null,
            });
            continue;
        }

        index++;

        while (index < htmlText.length && /\s/.test(htmlText[index])) {
            index++;
        }

        let value;

        if (htmlText[index] === '"' || htmlText[index] === "'") {
            const quote = htmlText[index++];
            const valueStart = index;

            while (index < htmlText.length && htmlText[index] !== quote) {
                index++;
            }

            value = htmlText.slice(valueStart, index);

            if (index < htmlText.length) {
                index++;
            }
        } else {
            const valueStart = index;

            while (
                index < htmlText.length &&
                !/[\s>]/.test(htmlText[index]) &&
                htmlText[index] !== "<"
                ) {
                index++;
            }

            value = htmlText.slice(valueStart, index);
        }

        attributes.push({
            name,
            value,
        });
    }

    return {
        attributes,
        isSelfClosing,
        nextIndex: index,
    };
}

/**
 * Reads comment content up to `-->`.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ token: Object, nextIndex: number }}
 */
function readComment(htmlText, startIndex) {
    const contentStart = startIndex + 4;
    const endIndex = htmlText.indexOf("-->", contentStart);

    if (endIndex === -1) {
        return {
            token: {
                type: "comment",
                value: htmlText.slice(contentStart),
            },
            nextIndex: htmlText.length,
        };
    }

    return {
        token: {
            type: "comment",
            value: htmlText.slice(contentStart, endIndex),
        },
        nextIndex: endIndex + 3,
    };
}

/**
 * Reads processing instructions / XML declarations up to `?>`.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ token: Object, nextIndex: number }}
 */
function readProcessingInstruction(htmlText, startIndex) {
    const endIndex = htmlText.indexOf("?>", startIndex + 2);

    if (endIndex === -1) {
        return {
            token: {
                type: "processingInstruction",
                value: htmlText.slice(startIndex + 2),
            },
            nextIndex: htmlText.length,
        };
    }

    return {
        token: {
            type: "processingInstruction",
            value: htmlText.slice(startIndex + 2, endIndex),
        },
        nextIndex: endIndex + 2,
    };
}

/**
 * Reads DOCTYPE payload up to `>`.
 * @param {string} htmlText
 * @param {number} startIndex
 * @returns {{ token: Object, nextIndex: number }}
 */
function readDoctype(htmlText, startIndex) {
    const endIndex = htmlText.indexOf(">", startIndex);

    if (endIndex === -1) {
        return {
            token: {
                type: "doctype", value: htmlText.slice(startIndex + 2),
            }, nextIndex: htmlText.length,
        };
    }

    return {
        token: {
            type: "doctype", value: htmlText.slice(startIndex + 2, endIndex),
        }, nextIndex: endIndex + 1,
    };
}

/**
 * Reads content inside RAWTEXT elements (<style>, <script>, etc.) up to `</tagName>`,
 * ignoring inner closing tags if they occur inside string literals or comments.
 * @param {string} htmlText
 * @param {number} startIndex
 * @param {string} tagName
 * @returns {{ value: string, nextIndex: number }}
 */
function readRawText(htmlText, startIndex, tagName) {
    const closingTag = `</${tagName}`.toLowerCase();
    const tagLen = closingTag.length;
    let index = startIndex;

    let inQuote = null;
    let inBlockComment = false;
    let inLineComment = false;

    while (index < htmlText.length) {
        if (inQuote) {
            if (htmlText[index] === "\\") {
                index += 2;
                continue;
            }
            if (htmlText[index] === inQuote) {
                inQuote = null;
            }
            index++;
            continue;
        }

        if (inBlockComment) {
            if (htmlText[index] === "*" && htmlText[index + 1] === "/") {
                inBlockComment = false;
                index += 2;
                continue;
            }
            index++;
            continue;
        }

        if (inLineComment) {
            if (htmlText[index] === "\n") {
                inLineComment = false;
            }
            index++;
            continue;
        }

        const char = htmlText[index];

        if (char === '"' || char === "'" || (tagName.toLowerCase() === "script" && char === "`")) {
            inQuote = char;
            index++;
            continue;
        }

        if (char === "/" && htmlText[index + 1] === "*") {
            inBlockComment = true;
            index += 2;
            continue;
        }

        if (tagName.toLowerCase() === "script" && char === "/" && htmlText[index + 1] === "/") {
            inLineComment = true;
            index += 2;
            continue;
        }

        if (
            char === "<" &&
            htmlText.slice(index, index + tagLen).toLowerCase() === closingTag
        ) {
            let testIndex = index + tagLen;

            while (testIndex < htmlText.length && /\s/.test(htmlText[testIndex])) {
                testIndex++;
            }

            if (htmlText[testIndex] === ">") {
                return {
                    value: htmlText.slice(startIndex, index),
                    nextIndex: index,
                };
            }
        }

        index++;
    }

    return {
        value: htmlText.slice(startIndex),
        nextIndex: htmlText.length,
    };
}