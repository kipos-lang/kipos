import React, { JSX, ReactElement, useEffect, useMemo, useState } from 'react';
import { js, lex } from '../lang/lexer';
import { childLocs, fromMap, Id, Node, Nodes, RecNodeT } from '../lang/nodes';
import { parser, ParseResult } from '../lang/algw-s2-return';
import {
    builtinEnv,
    composeSubst,
    Event,
    getGlobalState,
    inferExpr,
    inferStmt,
    resetState,
    StackText,
    State,
    Subst,
    Tenv,
    typeApply,
    typeFree,
    typeToString,
} from '../infer/algw/algw-s2-return';
import { Expr, Stmt, traverseStmt, Type } from '../infer/algw/Type';
import { Src } from '../lang/parse-dsl';
import { RenderEvent } from './RenderEvent';
import { hlShadow, RenderType } from './RenderType';
import { interleave } from './interleave';
import { ShowStacks } from './ShowText';
import { Numtip } from './Numtip';
import { LineManager, LineNumber, RenderNode } from './RenderNode';
import { currentTheme } from './themes';
import { Meta } from '../../one-world/sandbox/store/language';
import { ShowScope } from './ShowScope';

// const LEFT_WIDTH = 460
// const LEFT_WIDTH = 360;
const LEFT_WIDTH = 548;

const examples = {
    Quicksort: `let quicksort = (input) => {
if (input.length <= 1) {
return input}
let pivot = input[input.length - 1]
let leftArr = []
let rightArr = []
for (let i = 0; i < input.length; i += 1) {
if (input[i] <= pivot) {
    leftArr.push(input[i])
} else {
    rightArr.push(input[i])
}
}
return [
...quicksort(leftArr), pivot, ...quicksort(rightArr)]
}`,
    Fibbonacci: `let fib = (n) => {
if (n <= 1) {\nreturn 1}
return fib(n - 1) + fib(n - 2)
}`,
    'Imperative Fibbonacci': `let fib = (n) => {
    let fibs = []
    for (let i = 0; i < n; i += 1) {
        if (i <= 1) {
            fibs.unshift(1)
        } else {
            fibs.unshift(fibs[0] + fibs[1])
        }
    }
    return fibs[0]
}`,
    'Simple Variable': `{\nlet x = 2\n}`,
    'Functions as arguments': `(x, y, z) => {\n(x(2, y), x(z, true))}`,
    'Complex constraints': `let f = (x,m,n) => {\nlet z = [x(m,n),m];x(2, true)}`,
    'Destructured argument': `(one, (two, three)) => one + three`,
    Array: '{\nlet names = [];names.push("Kai")}',
    Example: `{
let example = (value, f) => {
    let things = []
    if (value > 10) {
        things.push(f(value))
    }
    things
}
    example
}`,
    'Generic Function': `{
    let two = (a) => [a, a];
    (two(1), two(true))
}`,
};

// const text = `(x) => {let (a, _) = x; a(2)}`;

export const opener = { round: '(', square: '[', curly: '{', angle: '<' };
export const closer = { round: ')', square: ']', curly: '}', angle: '>' };
export const braceColor = 'rgb(100, 200, 200)';
export const braceColorHl = 'rgb(0, 150, 150)';

export type Ctx = {
    showTips: boolean;
    calloutAnnotations: boolean;
    onClick(evt: NodeClick): void;
    highlightVars: string[];
    blanks: boolean;
    nodes: Nodes;
    highlight: string[];
    stackSrc: Record<string, { num: number; final: boolean }>;
    parsed: ParseResult<Stmt>;
    byLoc: Record<string, false | Type>;
    spans: Record<string, string[]>;
    multis: Record<string, true>;
};

export const styles = currentTheme.metaNode;
//     {
//     decl: { color: '#c879df' },
//     ref: { color: 'rgb(103 234 255)' }, //'rgb(255 90 68)' },
//     number: { color: '#e6ff00' },
//     kwd: { color: '#2852c7' },
//     punct: { color: 'gray' },
//     unparsed: { color: 'red' },
//     text: { color: 'yellow' },
// };

const traverse = (id: string, nodes: Nodes, f: (node: Node, path: string[]) => void, path: string[] = []) => {
    f(nodes[id], path);
    const next = path.concat([id]);
    childLocs(nodes[id]).forEach((child) => traverse(child, nodes, f, next));
};

// const byLoc: Record<string, Type> = {};
// glob.events.forEach((evt) => {
//     if (evt.type === 'infer' && !evt.src.right) {
//         byLoc[evt.src.left] = evt.value;
//     }
// });

export type NodeClick = { type: 'var'; name: string } | { type: 'ref'; loc: string } | { type: 'decl'; loc: string };

export const hlNode = {
    background: 'rgb(206 206 249)', //colors.accentLightRgba,
    // outline: `1px solid ${colors.accent}`,
};

export const Wrap = ({ children, id, ctx, multiline }: { children: ReactElement; id: string; ctx: Ctx; multiline?: boolean }) => {
    const t = ctx.byLoc[id];
    // const freeVbls = t ? typeFree(t) : [];
    // const color = ctx.byLoc[id] ? (freeVbls.length ? '#afa' : 'green') : null;
    const hlstyle = ctx.highlight[0] === id && !multiline ? hlShadow : ctx.highlight.includes(id) ? hlNode : undefined;
    const num = ctx.stackSrc[id];
    return (
        <span
            data-id={id}
            style={
                t
                    ? {
                          display: !multiline ? 'inline-block' : 'inline',
                      }
                    : undefined
            }
        >
            <span
                style={
                    !t
                        ? undefined
                        : multiline
                          ? { verticalAlign: 'top' }
                          : {
                                display: 'flex',
                                alignItems: 'flex-start',
                            }
                }
            >
                <span style={{ ...hlstyle, borderRadius: 4 }}>
                    <span style={{ position: 'relative' }}>{num && ctx.showTips ? <Numtip inline n={num.num} final={num.final} /> : null}</span>
                    {children}
                </span>
                {t || (ctx.blanks && t === false) ? (
                    <span style={{ color: '#666' }}>
                        {': '}
                        <span style={ctx.calloutAnnotations ? hlShadow : undefined}>
                            {t ? <RenderType t={t} highlightVars={ctx.highlightVars} onClick={(name) => ctx.onClick({ type: 'var', name })} /> : '_'}
                        </span>
                    </span>
                ) : null}
            </span>
        </span>
    );
};

export type Frame = { stack: OneStack[]; title: string };

export type OneStack =
    | { text: StackText[]; src: Src; type: 'line' }
    | { type: 'unify'; one: Type; subst: Subst; two: Type; src: Src; oneName: string; twoName: string; message?: string; first?: boolean };

export const App = () => {
    const [selected, setSelected] = useState('Quicksort' as keyof typeof examples);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                background: currentTheme.background,
                color: currentTheme.color,
                overflow: 'auto',
            }}
        >
            <div style={{ margin: 8 }}>
                {Object.keys(examples).map((key) => (
                    <button
                        style={{
                            padding: '2px 8px',
                            background: selected === key ? '#aaa' : 'transparent',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: selected === key ? 'black' : undefined,
                        }}
                        key={key}
                        disabled={selected === key}
                        onClick={() => setSelected(key as keyof typeof examples)}
                    >
                        {key}
                    </button>
                ))}
            </div>
            <Example key={selected} text={examples[selected]} />
        </div>
    );
};

const nextIndex = <T,>(arr: T[], f: (t: T) => any, start = 0) => {
    console.log('starting from', start);
    for (; start < arr.length; start++) {
        if (f(arr[start])) return start;
    }
    return null;
};

export const Example = ({ text }: { text: string }) => {
    const [blanks, setBlanks] = useState(true);
    const [showTips, setShowTips] = useState(true);
    const [highlight, setHighlight] = useState(true);
    const [skipFirst, setSkipFirst] = useState(false);
    const [calloutAnnot, setCalloutAnnot] = useState(false);

    const { cst, parsed } = useMemo(() => {
        const cst = lex(js, text);
        // console.log(JSON.stringify(cst, null, 2));
        const node = fromMap(cst.roots[0], cst.nodes, (idx) => idx);
        // console.log(JSON.stringify(node, null, 2));
        const parsed = parser.parse(node);
        if (!parsed.result) throw new Error(`not parsed ${text}`);
        // console.log(parsed.result);

        return { cst, parsed };
    }, [text]);

    const glob = useMemo(() => {
        resetState();

        const env = builtinEnv();
        const glob = getGlobalState();

        let res;
        try {
            res = inferStmt(env, parsed.result!);
        } catch (err) {
            console.log('bad inference', err);
            res = null;
        }

        return glob;
    }, [parsed]);

    const [at, setAt] = useState(0);

    const breaks = useMemo(() => stackForEvt(glob.events.length, glob.events), [glob.events]);
    useKeyboard(setAt, breaks);

    const relevantBuiltins = useMemo(() => findRelevantBuiltins(parsed.result!), [parsed]);

    const { byLoc, scope, smap, stack, highlightVars } = useMemo(() => {
        return processStack(glob.events, parsed.ctx.meta, at, skipFirst);
    }, [at, skipFirst, glob.events, parsed.ctx.meta]);

    const scopeToShow = useMemo(() => {
        const res: Tenv['scope'] = {};
        const env = builtinEnv();
        Object.keys(scope)
            .filter((k) => !env.scope[k])
            .forEach((k) => (res[k] = scope[k]));
        return res;
    }, [scope]);

    // const stack = stacks.length ? stacks[at] : undefined;
    const stackSrc: Record<string, { num: number; final: boolean }> = {};
    if (stack?.stack.length) {
        let last = stack.stack.length - 1;
        if (stack.stack[last].type === 'unify') last--;
        stack.stack.forEach((item, i) => {
            // if (!stackSrc[srcKey(item.src)]) {
            stackSrc[item.src.left] = { num: i + 1, final: i === last };
            // }
        });
        for (let i = stack.stack.length - 1; i >= 0; i--) {
            const item = stack.stack[i];
            if (item.src.left !== 'builtin') {
                stackSrc[item.src.left].final = true;
                break;
            }
        }
    }

    const multis = useMemo(() => findMultilineAncestors(cst), [cst]);
    const spans = useMemo(() => findSpans(glob), [glob]);
    const allLocs: string[] = [];
    const srcLocs = (src: Src) => coveredLocs(cst.nodes, src.left, src.right);

    // TODO: Indicate somehow whether you are the "outermost" highlight, or ... one of the inner ones?
    // const srcLocs = (src: Src) => (src.right ? [`${src.left}:${src.right}`] : [src.left]);
    // const allLocs = esrc.flatMap(srcLocs);

    if (highlight) {
        const last = stack.stack[stack.stack.length - 1];
        if (last.type === 'unify') {
            allLocs.push(...srcLocs(last.one.src), ...srcLocs(last.two.src));
        } else if (last.type === 'line') {
            allLocs.push(...srcLocs(last.src));
        }
    }
    // console.log(allLocs);

    const ctx: Ctx = {
        stackSrc,
        highlight: allLocs.filter((n) => n !== 'builtin'),
        showTips,
        calloutAnnotations: calloutAnnot,
        multis,
        spans,
        nodes: cst.nodes,
        blanks,
        parsed,
        byLoc,
        highlightVars,
        onClick(evt) {
            if (evt.type === 'ref' || evt.type === 'decl') {
                setAt((at) => {
                    const nat = nextIndex(
                        glob.events,
                        (gevt) => gevt.type === 'infer' && gevt.src.left === evt.loc && !gevt.src.right,
                        evtForStack(at, glob.events) + 2,
                    );
                    if (!nat) return at;
                    console.log('found it', nat);
                    const sat = stackForEvt(nat, glob.events);
                    if (sat !== 0) return sat;
                    return at;
                });
            } else {
                const nat = nextIndex(glob.events, (gevt) => gevt.type === 'unify' && gevt.subst[evt.name], evtForStack(at, glob.events) + 2);
                if (!nat) return;
                const sat = stackForEvt(nat, glob.events);
                if (sat !== 0) setAt(sat);
            }
            console.log('evt', evt);
        },
    };

    const locsInOrder = useMemo(() => {
        const inOrder: string[] = [];
        const handle = (id: string) => {
            inOrder.push(id);
            childLocs(cst.nodes[id]).forEach((child) => handle(child));
            inOrder.push(id + ':after');
        };
        cst.roots.forEach(handle);
        return inOrder;
    }, [cst]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ margin: 32 }}>
                Hindley Milner Type Inference Stepping Debugger
                <div style={{ marginBottom: 32, marginTop: 8 }}>
                    <input
                        type="range"
                        min="0"
                        style={{ marginLeft: 8, marginRight: 16 }}
                        max={breaks - 1}
                        value={at}
                        onChange={(evt) => setAt(+evt.target.value)}
                    />
                    <span style={{ display: 'inline-block', width: '5em' }}>
                        {at}/{breaks - 1}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                    <div
                        style={{
                            width: LEFT_WIDTH,
                            minWidth: LEFT_WIDTH,
                            marginRight: 16,
                            fontFamily: 'Jet Brains',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                        }}
                    >
                        <LineManager inOrder={locsInOrder}>
                            {cst.roots.map((root) => (
                                <div style={{ position: 'relative', padding: 8, paddingLeft: 40 }}>
                                    <LineNumber loc={root} />
                                    <RenderNode key={root} node={cst.nodes[root]} ctx={ctx} />
                                </div>
                            ))}
                        </LineManager>
                    </div>
                    <Sidebar stack={stack} showTips={ctx.showTips} smap={smap} highlightVars={highlightVars} onClick={ctx.onClick} />
                    <div>
                        <ShowScope smap={smap} scope={{ ...relevantBuiltins, ...scopeToShow }} highlightVars={highlightVars} ctx={ctx} />
                    </div>
                </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ padding: 32 }}>
                <label style={{ padding: 8 }}>
                    <input type="checkbox" checked={blanks} onChange={() => setBlanks(!blanks)} />
                    Show blank types
                </label>
                <label style={{ padding: 8 }}>
                    <input type="checkbox" checked={showTips} onChange={() => setShowTips(!showTips)} />
                    Show Num Tips
                </label>
                <label style={{ padding: 8 }}>
                    <input type="checkbox" checked={highlight} onChange={() => setHighlight(!highlight)} />
                    Highlight
                </label>
                <label style={{ padding: 8 }}>
                    <input type="checkbox" checked={skipFirst} onChange={() => setSkipFirst(!skipFirst)} />
                    SkipFirst
                </label>
                <label style={{ padding: 8 }}>
                    <input type="checkbox" checked={calloutAnnot} onChange={() => setCalloutAnnot((k) => !k)} />
                    Callout annotations
                </label>
            </div>
            {/* <Colors /> */}
        </div>
    );
};

const srcKey = (src: Src) => (src.right ? `${src.left}:${src.right}` : src.left);

const Sidebar = ({
    smap,
    stack,
    highlightVars,
    onClick,
    showTips,
}: {
    highlightVars: string[];
    stack?: Frame;
    smap: Subst;
    showTips: boolean;
    onClick(evt: NodeClick): void;
}) => {
    return (
        <div style={{ width: 500, marginRight: 8 }}>
            <ShowStacks showTips={showTips} subst={smap} stack={stack} hv={highlightVars} onClick={(name) => onClick({ type: 'var', name })} />
        </div>
    );
};

const Substs = ({ subst }: { subst: { name: string; type: Type }[] }) => {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', justifyContent: 'flex-start', gridAutoRows: 'max-content' }}>
            {subst.map((type, i) => (
                <React.Fragment key={i}>
                    <div>{type.name}</div>
                    <div>{typeToString(type.type)}</div>
                </React.Fragment>
            ))}
        </div>
    );
};

const ScopeDebug = ({ scope }: { scope: Tenv['scope'] }) => {
    return (
        <div style={{ whiteSpace: 'pre', display: 'grid', gridTemplateColumns: 'max-content max-content max-content', alignSelf: 'flex-start' }}>
            {Object.entries(scope).map(([key, scheme]) => (
                <div key={key} style={{ display: 'contents' }}>
                    <div>{key}</div>
                    <div>{scheme.vars.length ? '<' + scheme.vars.join(',') + '>' : ''}</div>
                    <div>{typeToString(scheme.body)}</div>
                </div>
            ))}
        </div>
    );
};

const ungroup = (group: Grouped): string[] => group.children.flatMap((child) => (typeof child === 'string' ? child : ungroup(child)));

export const RenderGrouped = ({ grouped, ctx, spaced }: { grouped: Grouped; ctx: Ctx; spaced: boolean }): ReactElement => {
    let children: ReactElement[] = grouped.children.map((item, i) =>
        typeof item === 'string' ? (
            <RenderNode key={item} node={ctx.nodes[item]} ctx={ctx} />
        ) : (
            <RenderGrouped key={i} grouped={item} ctx={ctx} spaced={spaced} />
        ),
    );
    if (spaced) {
        children = interleave(children, (i) => <span key={'int-' + i}>&nbsp;</span>);
    }

    const multi = ungroup(grouped).some((id) => ctx.multis[id]);
    if (!grouped.end) {
        return (
            <span
                style={
                    multi
                        ? {}
                        : {
                              display: 'inline-flex',
                              alignItems: 'flex-start',
                          }
                }
            >
                {children}
            </span>
        );
    }
    return (
        <Wrap id={grouped.id!} ctx={ctx} multiline={multi}>
            {children as any}
        </Wrap>
    );
};

type Grouped = { id?: string; end?: string; children: (string | Grouped)[] };

export const partition = (ctx: Ctx, children: string[]) => {
    // const groups: Grouped = {children: []}
    const stack: Grouped[] = [{ children: [] }];

    const better = children.map((child) => {
        if (!ctx.spans[child]) return [];
        return ctx.spans[child]
            .map((id) => ({ id, idx: children.indexOf(id) }))
            .sort((a, b) => b.idx - a.idx)
            .map((s) => s.id);
    });

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
        console.log(stack);
        console.error('didnt clen up all stacks');
    }
    return stack[0];
};

export const coveredLocs = (nodes: Nodes, left: string, right?: string) => {
    if (!right) {
        const node = nodes[left];
        if (node?.type === 'list' && node.forceMultiline) {
            return [left, ...node.children];
        }
        return [left];
    }
    for (const node of Object.values(nodes)) {
        const children = childLocs(node);
        const li = children.indexOf(left);
        if (li === -1) continue;
        const ri = children.indexOf(right);
        if (ri === -1) continue;
        const match = children.slice(li, ri + 1);
        for (let i = li; i <= ri; i++) {
            const node = nodes[children[i]];
            if (node?.type === 'list' && node.forceMultiline) {
                match.push(...node.children);
            }
        }
        return [`${left}:${right}`, ...match];
    }
    return [`${left}:${right}`, left, right];
};

const eventSrc = (evt: Event) => {
    switch (evt.type) {
        case 'unify':
            // return evt.
            return [evt.one.src, evt.two.src];
        case 'infer':
            return [evt.src];
    }
    return [];
};

const evtForStack = (at: number, events: Event[]) => {
    let num = 0;
    let i = 0;
    for (; i < events.length && num < at; i++) {
        const e = events[i];
        if (e.type === 'stack-break') {
            num++;
        }
        if (e.type === 'unify' && Object.keys(e.subst).length) {
            num += 2;
        }
    }
    return i;
};

export const stackForEvt = (at: number, events: Event[]) => {
    let num = 0;
    for (let i = 0; i < at; i++) {
        const e = events[i];
        if (e.type === 'stack-break') {
            num++;
        }
        if (e.type === 'unify' && Object.keys(e.subst).length) {
            num += 2;
        }
    }
    return num;
};

export const findSpans = (glob: State) => {
    const spans: Record<string, string[]> = {};

    glob.events.forEach((evt) => {
        if (evt.type === 'infer' && evt.src.right) {
            if (!spans[evt.src.left]) spans[evt.src.left] = [];
            if (!spans[evt.src.left].includes(evt.src.right)) spans[evt.src.left].push(evt.src.right);
        }
        if (evt.type === 'stack-push' && evt.src.right) {
            if (!spans[evt.src.left]) spans[evt.src.left] = [];
            if (!spans[evt.src.left].includes(evt.src.right)) spans[evt.src.left].push(evt.src.right);
        }
    });

    return spans;
};

export const findMultilineAncestors = (cst: { roots: string[]; nodes: Nodes }) => {
    const multis: Record<string, true> = {};
    cst.roots.forEach((root) =>
        traverse(root, cst.nodes, (node, path) => {
            if (node.type === 'list' && node.forceMultiline) {
                console.log('found one', node, path);
                path.forEach((id) => (multis[id] = true));
                multis[node.loc] = true;
            }
        }),
    );
    return multis;
};

export const processStack = (events: State['events'], meta: Record<string, Meta>, at: number, skipFirst = false) => {
    const byLoc: Record<string, Type | false> = {};
    let highlightVars: string[] = [];
    let smap: Subst = {};
    let scope: Tenv['scope'] = {};

    const stacks: Frame[] = [];
    const stack: OneStack[] = [];
    top: for (let i = 0; i < events.length && at >= stacks.length; i++) {
        const evt = events[i];
        if (!evt) {
            console.log(events, i);
            debugger;
        }
        switch (evt.type) {
            case 'stack-push':
                stack.push({ text: evt.value, src: evt.src, type: 'line' });
                break;
            case 'stack-pop':
                stack.pop();
                break;
            case 'stack-break':
                stacks.push({ stack: stack.slice(), title: evt.title });
                break;
            case 'new-var':
                break;
            case 'unify':
                const has = Object.keys(evt.subst).length;
                if (has) {
                    stack.push({ ...evt, first: true });
                    stacks.push({ stack: stack.slice(), title: 'Unification result' });
                    stack.pop();
                    if (stacks.length > at) {
                        highlightVars = Object.keys(evt.subst);
                        break top;
                    }
                    stack.push(evt);
                    stacks.push({ stack: stack.slice(), title: 'Unification result' });
                    stack.pop();
                }
                break;
        }
        if (evt.type === 'infer') {
            if (!evt.src.right && (meta[evt.src.left]?.kind === 'decl' || meta[evt.src.left]?.kind === 'fn-args')) {
                byLoc[evt.src.left] = evt.value;
            }
        }
        if (evt.type === 'unify' && !evt.tmp) {
            smap = composeSubst(evt.subst, smap);
        }
        if (evt.type === 'scope') {
            scope = evt.scope;
        }
    }
    Object.entries(meta).forEach(([loc, meta]) => {
        if (meta.kind === 'decl' || meta.kind === 'fn-args') {
            if (!byLoc[loc]) byLoc[loc] = false;
        }
    });

    Object.keys(byLoc).forEach((k) => {
        if (byLoc[k]) byLoc[k] = typeApply(smap, byLoc[k]);
    });

    if (skipFirst) {
        const k = Object.keys(byLoc)[0];
        if (k) {
            delete byLoc[k];
        }
    }

    return { byLoc, scope, smap, stack: stacks[at], highlightVars };
};

export const findRelevantBuiltins = (result: Stmt) => {
    const refs: string[] = [];
    traverseStmt(result, {
        visitExpr(expr) {
            if (expr.type === 'var') {
                refs.push(expr.name);
            }
        },
    });
    const builtins: Tenv['scope'] = {};
    const tenv = builtinEnv();
    refs.forEach((ref) => {
        if (tenv.scope[ref]) {
            builtins[ref] = tenv.scope[ref];
        }
    });

    return builtins;
};

const useKeyboard = (setAt: (f: (n: number) => number) => void, breaks: number) => {
    useEffect(() => {
        const fn = (evt: KeyboardEvent) => {
            if (window.document.activeElement != document.body) return;
            if (evt.key === ' ' || evt.key === 'ArrowRight') {
                setAt((at) => Math.min(at + 1, breaks - 1));
            }
            if (evt.key === 'ArrowLeft') {
                setAt((at) => Math.max(0, at - 1));
            }
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [breaks]);
};
