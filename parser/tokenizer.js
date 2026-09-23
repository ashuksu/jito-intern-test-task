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

        index++;
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