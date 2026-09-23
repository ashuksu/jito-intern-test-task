const VOID_ELEMENTS = new Set([
    "meta",
    "link",
    "img",
    "input",
    "br",
    "hr",
    "source",
    "base",
    // "col",
    // "track",
    // "wbr",
    // "area",
    // "embed",
    // "param",
]);

export function tokenize(htmlText) {
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

        if (htmlText.slice(index, index + 9).toLowerCase() === "<!doctype") {
            const nextChar = htmlText[index + 9];

            if (!nextChar || /[\s>]/.test(nextChar)) {
                const doctypeResult = readDoctype(htmlText, index);

                tokens.push(doctypeResult.token);
                index = doctypeResult.nextIndex;
                continue;
            }
        }

        const tagResult = readTag(htmlText, index);
        tokens.push(tagResult.token);
        index = tagResult.nextIndex;

        if (
            tagResult.token.type === "startTag" &&
            (tagResult.token.tagName === "script" ||
                tagResult.token.tagName === "style") &&
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

function readTag(htmlText, startIndex) {
    let index = startIndex + 1;

    const isClosing = /^<\/[a-zA-Z][a-zA-Z0-9-]*(?:\s|>)/.test(
        htmlText.slice(startIndex)
    );

    if (isClosing) {
        index++;
    }

    const nameStart = index;

    if (!/[a-zA-Z]/.test(htmlText[index])) {
        return {
            token: {
                type: "text",
                value: "<",
            },
            nextIndex: startIndex + 1,
        };
    }

    while (
        index < htmlText.length &&
        /[a-zA-Z0-9-]/.test(htmlText[index])
        ) {
        index++;
    }

    const tagName = htmlText.slice(nameStart, index).toLowerCase();

    if (
        htmlText[index] !== ">" &&
        !/\s/.test(htmlText[index]) &&
        htmlText[index] !== "/"
    ) {
        return {
            token: {
                type: "text",
                value: "<",
            },
            nextIndex: startIndex + 1,
        };
    }

    if (isClosing) {
        while (index < htmlText.length && htmlText[index] !== ">") {
            index++;
        }
        return {
            token: {
                type: "endTag",
                tagName,
            },
            nextIndex: index + 1,
        };
    }

    const {attributes, isSelfClosing, nextIndex} = readAttributes(
        htmlText,
        index
    );

    return {
        token: {
            type: "startTag",
            tagName,
            attributes,
            isSelfClosing: isSelfClosing || VOID_ELEMENTS.has(tagName),
        },
        nextIndex: nextIndex + 1,
    };
}

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

        if (htmlText[index] === "/" && htmlText[index + 1] === ">") {
            isSelfClosing = true;
            index++;
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
                !/[\s>]/.test(htmlText[index])
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

function readRawText(htmlText, startIndex, tagName) {
    const lowerHtml = htmlText.toLowerCase();
    const closingTag = `</${tagName}`;
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

        if (char === '"' || char === "'" || (tagName === "script" && char === "`")) {
            inQuote = char;
            index++;
            continue;
        }

        if (char === "/" && htmlText[index + 1] === "*") {
            inBlockComment = true;
            index += 2;
            continue;
        }

        if (tagName === "script" && char === "/" && htmlText[index + 1] === "/") {
            inLineComment = true;
            index += 2;
            continue;
        }

        if (lowerHtml.startsWith(closingTag, index)) {
            let testIndex = index + closingTag.length;

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