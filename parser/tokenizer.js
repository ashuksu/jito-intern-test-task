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
    const endIndex = htmlText.indexOf(">", startIndex);
    const actualEnd = endIndex === -1 ? htmlText.length : endIndex;
    const content = htmlText.slice(startIndex + 1, actualEnd).trim();

    if (content.startsWith("/")) {
        return {
            token: {
                type: "endTag",
                tagName: content.slice(1).trim().toLowerCase(),
            },
            nextIndex: actualEnd + 1,
        };
    }

    const isSelfClosing = content.endsWith("/");
    const cleanContent = isSelfClosing ? content.slice(0, -1).trim() : content;
    const spaceIndex = cleanContent.search(/\s/);
    const tagName = (spaceIndex === -1 ? cleanContent : cleanContent.slice(0, spaceIndex)).toLowerCase();

    return {
        token: {
            type: "startTag",
            tagName,
            isSelfClosing,
        },
        nextIndex: actualEnd + 1,
    };
}