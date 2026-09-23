export function buildTree(tokens) {
    const root = [];

    const stack = [
        {
            type: "root",
            children: root,
        },
    ];

    for (const token of tokens) {
        if (token.type === "text") {
            appendChild(stack, token);
        } else if (token.type === "comment") {
            appendChild(stack, {
                type: "comment",
                value: token.value,
            });
        } else if (token.type === "doctype") {
            appendChild(stack, {
                type: "doctype",
                value: token.value,
            });
        } else if (token.type === "startTag") {
            const elementNode = {
                type: "element",
                tagName: token.tagName,
                attributes: token.attributes,
                children: [],
            };

            appendChild(stack, elementNode);

            if (!token.isSelfClosing) {
                stack.push(elementNode);
            }
        } else if (token.type === "endTag") {
            let matchIndex = -1;
            const lowerEndTag = token.tagName.toLowerCase();

            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].tagName.toLowerCase() === lowerEndTag) {
                    matchIndex = i;
                    break;
                }
            }

            if (matchIndex !== -1) {
                stack.length = matchIndex;
            } else {
                appendChild(stack, {
                    type: "text",
                    value: `</${token.tagName}>`,
                });
            }
        }
    }

    return root;
}

function appendChild(stack, node) {
    const parent = stack[stack.length - 1];

    parent.children.push(node);
}