import { Id, Loc, RecNode } from '../../../shared/cnodes';
import { Expr } from '../../../syntaxes/algw-s2-types';
import { Src } from '../../../syntaxes/dsl3';

const precedence = [['!=', '=='], ['>', '<', '>=', '<='], ['%'], ['+', '-'], ['*', '/'], ['^']];
const opprec: Record<string, number> = {};
precedence.forEach((row, i) => {
    row.forEach((n) => (opprec[n] = i));
});

type Data = { type: 'tmp'; left: Expr | Data; op: { text: string; loc: string }; prec: number; right: Expr | Data; src: Src };

const add = (data: Data | Expr, op: { text: string; loc: string }, right: Expr): Data => {
    const prec = opprec[op.text];
    if (data.type !== 'tmp' || prec <= data.prec) {
        return { type: 'tmp', left: data, op, prec, right, src: mergeSrc(data.src, right.src) };
    } else {
        return { ...data, right: add(data.right, op, right) };
    }
};

const dataToExpr = (data: Data | Expr): Expr => {
    if (data.type !== 'tmp') return data;
    const left = dataToExpr(data.left);
    const right = dataToExpr(data.right);
    return {
        type: 'app',
        target: { type: 'var', name: data.op.text, src: { type: 'src', left: data.op.loc } },
        args: { type: 'unnamed', src: data.src, args: [left, right] },
        src: data.src,
    };
};

const mergeSrc = (one: Src, two?: Src): Src => ({ type: 'src', left: one.left, right: two?.right ?? two?.left ?? one.right });

export const nodesSrc = (nodes: RecNode | RecNode[]): Src =>
    Array.isArray(nodes)
        ? nodes.length === 1
            ? { type: 'src', left: nodes[0].loc }
            : {
                  type: 'src',
                  left: nodes[0].loc,
                  right: nodes[nodes.length - 1].loc,
              }
        : { type: 'src', left: nodes.loc };

// This is probably the same algorithm as the simple precedence parser
// https://en.wikipedia.org/wiki/Simple_precedence_parser
export const partition = (left: Expr, rights: { op: { text: string; loc: string }; right: Expr }[]) => {
    let data: Data | Expr = left;
    rights.forEach(({ op, right }) => {
        data = add(data, op, right);
    });
    return dataToExpr(data);
};
