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
        }
    }

    return root;
}

function appendChild(stack, node) {
    const parent = stack[stack.length - 1];

    parent.children.push(node);
}