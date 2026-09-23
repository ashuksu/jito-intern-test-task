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

        const tagResult = readTag(htmlText, index);
        tokens.push(tagResult.token);
        index = tagResult.nextIndex;
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
        !/\s/.test(htmlText[index])
    ) {
        return {
            token: {
                type: "text",
                value: "<",
            },
            nextIndex: startIndex + 1,
        };
    }

    while (index < htmlText.length && htmlText[index] !== ">") {
        index++;
    }

    if (index === htmlText.length) {
        return {
            token: {
                type: "text",
                value: htmlText.slice(startIndex),
            },
            nextIndex: index,
        };
    }

    if (isClosing) {
        return {
            token: {
                type: "endTag",
                tagName,
            },
            nextIndex: index + 1,
        };
    }

    const content = htmlText.slice(startIndex + 1, index).trim();
    const isSelfClosing = content.endsWith("/");

    const attributesEnd = isSelfClosing ? index - 1 : index;

    const attributes = readAttributes(
        htmlText,
        nameStart + tagName.length,
        attributesEnd
    );

    return {
        token: {
            type: "startTag",
            tagName,
            attributes,
            isSelfClosing: isSelfClosing || VOID_ELEMENTS.has(tagName),
        },
        nextIndex: index + 1,
    };
}

function readAttributes(htmlText, startIndex, endIndex) {
    const attributes = [];
    let index = startIndex;

    while (index < endIndex) {
        while (index < endIndex && /\s/.test(htmlText[index])) {
            index++;
        }

        if (index >= endIndex || htmlText[index] === "/") {
            break;
        }

        const nameStart = index;

        while (
            index < endIndex &&
            !/[\s=>]/.test(htmlText[index])
            ) {
            index++;
        }

        const name = htmlText.slice(nameStart, index);

        while (index < endIndex && /\s/.test(htmlText[index])) {
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

        while (index < endIndex && /\s/.test(htmlText[index])) {
            index++;
        }

        let value;

        if (htmlText[index] === '"' || htmlText[index] === "'") {
            const quote = htmlText[index++];
            const valueStart = index;

            while (index < endIndex && htmlText[index] !== quote) {
                index++;
            }

            value = htmlText.slice(valueStart, index);

            if (index < endIndex) {
                index++;
            }
        } else {
            const valueStart = index;

            while (
                index < endIndex &&
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

    return attributes;
}