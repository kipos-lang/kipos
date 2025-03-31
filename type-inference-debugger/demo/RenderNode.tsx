import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Node } from '../lang/nodes';
import { Ctx, Wrap, styles, partition, RenderGrouped, opener, closer, hlNode } from './App';
import { interleave } from './interleave';
import { list } from '../lang/parse-dsl';
import { colors } from './RenderType';

export const RenderNode = ({ node, ctx }: { node: Node; ctx: Ctx }) => {
    // const ty = t ? typeApply(glob.subst, t) : null;
    return (
        <Wrap id={node.loc} ctx={ctx} multiline={node.type === 'list' && node.forceMultiline}>
            <RenderNode_ node={node} ctx={ctx} />
        </Wrap>
    );
};
const RenderNode_ = ({ node, ctx }: { node: Node; ctx: Ctx }) => {
    const meta = ctx.parsed.ctx.meta[node.loc];
    let style: React.CSSProperties = styles[meta?.kind as 'kwd'];
    // if (ctx.highlight.includes(node.loc)) {
    //     style = { ...style };
    //     style.backgroundColor = '#700';
    // }
    switch (node.type) {
        case 'id':
            if (meta?.kind === 'decl') {
                return (
                    <span style={{ ...style, cursor: 'pointer' }} onClick={() => ctx.onClick({ type: 'decl', loc: node.loc })}>
                        {node.text}
                    </span>
                );
            }
            if (meta?.kind === 'ref') {
                return (
                    <span style={{ ...style, cursor: 'pointer' }} onClick={() => ctx.onClick({ type: 'ref', loc: node.loc })}>
                        {node.text}
                    </span>
                );
            }
            return <span style={style}>{node.text}</span>;
        case 'text':
            return (
                <span style={style}>
                    "
                    {node.spans.map((span, i) =>
                        span.type === 'text' ? (
                            <span key={i}>{span.text}</span>
                        ) : (
                            <span key={span.item}>
                                {'${'}
                                <RenderNode node={ctx.nodes[span.item]} ctx={ctx} />
                                {'}'}
                            </span>
                        ),
                    )}
                    "
                </span>
            );
        case 'list':
            if (node.kind === 'smooshed') {
                const parts = partition(ctx, node.children);
                return (
                    <span style={style}>
                        <RenderGrouped spaced={false} grouped={parts} ctx={ctx} />
                    </span>
                );
            }
            if (node.kind === 'spaced') {
                const parts = partition(ctx, node.children);
                return (
                    <span style={style}>
                        <RenderGrouped spaced grouped={parts} ctx={ctx} />
                    </span>
                );
            }
            const sep = ctx.parsed.ctx.meta[node.loc]?.kind === 'semi-list' || node.kind === 'curly' ? ';' : ',';
            return (
                <span style={style}>
                    <span style={styles.punct}>{opener[node.kind]}</span>
                    {/* {node.forceMultiline ? <br /> : null} */}
                    {interleave(
                        node.children.map((id) => (
                            <span
                                key={id}
                                style={
                                    node.forceMultiline
                                        ? { paddingLeft: 16, display: 'block', ...(ctx.highlight.includes(id) ? hlNode : {}) }
                                        : undefined
                                }
                            >
                                {node.forceMultiline ? <LineNumber loc={id} /> : null}
                                <RenderNode key={id} node={ctx.nodes[id]} ctx={ctx} />
                                {node.forceMultiline ? (node.kind === 'curly' ? null : sep) : null}
                            </span>
                        )),
                        (i) => (node.forceMultiline ? null : <span key={'mid-' + i}>{sep + ' '}</span>),
                    )}
                    {node.forceMultiline ? <LineNumber loc={node.loc + ':after'} /> : null}
                    {/* {node.forceMultiline ? <br /> : null} */}
                    <span style={styles.punct}>{closer[node.kind]}</span>
                </span>
            );
        case 'table':
            return <span style={style}>TABLE</span>;
    }
};

export const LineCtx = React.createContext({
    useNumber(loc: string): number {
        return 0;
    },
});

export const LineManager = ({ children, inOrder }: { inOrder: string[]; children: React.ReactNode }) => {
    const listeners = useRef({} as Record<string, (num: number) => void>);
    const resend = useCallback(() => {
        const keys = Object.keys(listeners.current)
            .map((k) => ({ k, n: inOrder.indexOf(k) }))
            .sort((a, b) => a.n - b.n)
            .map((k) => k.k);
        keys.forEach((k, i) => {
            listeners.current[k](i + 1);
        });
    }, [inOrder]);
    const useNumber = useCallback((loc: string) => {
        const [state, setState] = useState(0);
        useEffect(() => {
            const change = !listeners.current[loc];
            listeners.current[loc] = (num: number) => {
                setState(num);
            };
            resend();
            return () => {
                delete listeners.current[loc];
                resend();
            };
        }, [loc]);
        return state;
    }, []);
    const value = useMemo(() => ({ useNumber }), [useNumber]);
    return <LineCtx.Provider value={value}>{children}</LineCtx.Provider>;
};

export const LineNumber = ({ loc }: { loc: string }) => {
    // not sure how to cound this
    const num = useContext(LineCtx).useNumber(loc);
    return (
        <div
            style={{
                whiteSpace: 'pre',
                position: 'absolute',
                left: 0,
                color: colors.accent,
                fontWeight: 100,
                borderRight: '1px solid #555',
                // color: 'black',
                //
                padding: '0 8px 0 0',
                // background: 'rgba(255,255,255,0.5)',
                // background: 'rgba(255,255,255,0.5)',
            }}
        >
            {num === 0 ? '  ' : num.toString().padStart(2, ' ')}
        </div>
    );
};
