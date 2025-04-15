import { Src } from '../../syntaxes/dsl3';
import { ParseKind, ParseResult, ValidateResult } from './language';

export const findSpans = (items: Src[]) => {
    const spans: Record<string, string[]> = {};

    items.forEach((src) => {
        if (src.right) {
            if (!spans[src.left]) spans[src.left] = [];
            if (!spans[src.left].includes(src.right)) spans[src.left].push(src.right);
        }
    });

    return spans;
};

export type LangResult = ParseResult<any, ParseKind> & { validation?: ValidateResult<any> | null; spans: Record<string, string[][]> };

// export const makeEditor = (
//     selected: string,
//     modules: Record<string, Module>,
//     shout: (evt: Evt) => void,
//     recompile: (ids: string[], state: EditorState<any, any>) => void,
//     store: EditorStore<any, any>,
// ): EditorStoreI => {
//     let language = defaultLang;

//     return {
//         update(action: Action) {
//         },
//     };
// };

export type Grouped = { id?: string; end?: string; children: (string | Grouped)[] };

export const partition = (better: string[][], children: string[]) => {
    const stack: Grouped[] = [{ children: [] }];

    for (let i = 0; i < children.length; i++) {
        const current = stack[stack.length - 1];
        const spans = better[i];
        const child = children[i];
        if (!spans.length) {
            current.children.push(child);
            while (stack[stack.length - 1].end === child) {
                stack.pop();
            }
            continue;
        }

        spans.forEach((id) => {
            const inner: Grouped = { end: id, children: [], id: `${child}:${id}` };
            stack[stack.length - 1].children.push(inner);
            stack.push(inner);
        });
        stack[stack.length - 1].children.push(child);
    }
    if (stack.length !== 1) {
        // So... this happens when the /end/ of a span isn't actually within the children, right?
        // or when things are out of order somehow?
        // I'll just ignore for the moment.
    }
    return stack[0];
};

export const srcKey = (src: Src) => (src.right ? `${src.left}:${src.right}` : src.left);
