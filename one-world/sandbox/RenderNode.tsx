import React, { useMemo, useContext } from 'react';
import { interleaveF } from '../keyboard/interleave';
import { TextWithCursor, Cursor } from '../keyboard/ui/cursor';
import { opener, closer } from '../keyboard/ui/RenderNode';
import { Path, ListWhere, IdCursor, pathWithChildren, selStart } from '../keyboard/utils';
import { Node } from '../shared/cnodes';
import { splitGraphemes } from '../splitGraphemes';
import { cursorPositionInSpanForEvt, UseNodeCtx } from './App';
import { SelStatus } from './store';
import { useDrag } from './Editor';
import { lightColor } from '../keyboard/ui/colors';

const R = ({ node, self, sel }: { node: Node; self: Path; sel?: SelStatus }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);

    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    const style = hl ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` } : undefined;

    const drag = useDrag();
    switch (node.type) {
        case 'id':
            const text = splitGraphemes(node.text);
            if (!sel)
                return (
                    <span
                        style={style}
                        ref={drag.ref(node.loc)}
                        onMouseDown={(evt) => {
                            evt.preventDefault();
                            evt.stopPropagation();
                            const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                            drag.start(selStart(self, { type: 'id', end: pos ?? 0 }), evt.metaKey);
                        }}
                        onMouseMove={(evt) => {
                            if (drag.dragging) {
                                evt.preventDefault();
                                evt.stopPropagation();
                                const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                                drag.move(selStart(self, { type: 'id', end: pos ?? 0 }), evt.ctrlKey, evt.altKey);
                            }
                        }}
                    >
                        {node.text}
                    </span>
                );
            return (
                <span style={style}>
                    <TextWithCursor
                        text={text}
                        innerRef={drag.ref(node.loc)}
                        highlight={sel.highlight?.type === 'id' ? sel.highlight.spans : undefined}
                        cursors={(sel.cursors.filter((c) => c.type === 'id') as IdCursor[]).map((c) => c.end)}
                        onMouseDown={(evt) => {
                            console.log('mousedown');
                            evt.preventDefault();
                            evt.stopPropagation();
                            const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                            drag.start(selStart(self, { type: 'id', end: pos ?? 0 }), evt.metaKey);
                        }}
                        onMouseMove={(evt) => {
                            if (drag.dragging) {
                                evt.preventDefault();
                                evt.stopPropagation();
                                const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                                drag.move(selStart(self, { type: 'id', end: pos ?? 0 }), evt.ctrlKey, evt.altKey);
                            }
                        }}
                    />
                </span>
            );
        case 'text':
            return (
                <span ref={drag.ref(node.loc)} style={style}>
                    {has('before') ? <Cursor /> : null}"{has('inside') ? <Cursor /> : null}
                    {node.spans.map((span, i) => {
                        const sc = sel?.cursors.filter((c) => c.type === 'text' && (c.end.index === i || c.end.index === span.loc));
                        if (span.type === 'text') {
                            if (sc?.length) {
                                const hl = sel?.highlight?.type === 'text' ? sel.highlight.spans[i] : undefined;
                                const text = splitGraphemes(span.text);
                                return (
                                    <TextWithCursor
                                        key={i}
                                        text={splitGraphemes(span.text)}
                                        highlight={hl}
                                        cursors={sc.map((s) => (s.type === 'text' ? s.end.cursor : 0))}
                                        onMouseDown={(evt) => {
                                            evt.stopPropagation();
                                            evt.preventDefault();
                                            const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                                            drag.start(
                                                selStart(self, {
                                                    type: 'text',
                                                    end: { index: i, cursor: pos ?? 0 },
                                                }),
                                            );
                                        }}
                                        onMouseMove={(evt) => {
                                            if (drag.dragging) {
                                                evt.stopPropagation();
                                                evt.preventDefault();
                                                const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                                                drag.move(
                                                    selStart(self, {
                                                        type: 'text',
                                                        end: { index: i, cursor: pos ?? 0 },
                                                    }),
                                                    evt.ctrlKey,
                                                    evt.altKey,
                                                );
                                            }
                                        }}
                                    />
                                );
                            }
                            const hl = sel?.highlight?.type === 'text' ? sel.highlight.spans[i] : undefined;
                            return (
                                <span
                                    key={i}
                                    style={hl ? { backgroundColor: lightColor } : undefined}
                                    // style={style}
                                    // style={{ backgroundColor: 'red' }}
                                    onMouseDown={(evt) => {
                                        evt.stopPropagation();
                                        evt.preventDefault();
                                        const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, splitGraphemes(span.text));
                                        drag.start(selStart(self, { type: 'text', end: { index: i, cursor: pos ?? 0 } }));
                                    }}
                                    onMouseMove={(evt) => {
                                        if (drag.dragging) {
                                            evt.stopPropagation();
                                            evt.preventDefault();
                                            const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, splitGraphemes(span.text));
                                            drag.move(selStart(self, { type: 'text', end: { index: i, cursor: pos ?? 0 } }), evt.ctrlKey, evt.altKey);
                                        }
                                    }}
                                >
                                    {span.text}
                                </span>
                            );
                        }
                        if (span.type === 'embed') {
                            return (
                                <span key={i}>
                                    {'${'}
                                    <RenderNode key={i} parent={self} id={span.item} />
                                    {'}'}
                                </span>
                            );
                        }
                        return 'SPAN' + span.type;
                    })}
                    "{has('after') ? <Cursor /> : null}
                </span>
            );
        // return <span>{node.text}</span>;
        case 'list':
            if (typeof node.kind !== 'string') return 'UK';
            const children = node.children.map((id) =>
                node.forceMultiline ? (
                    <span
                        style={{
                            display: 'block',
                            paddingLeft: 32,
                        }}
                        key={id}
                    >
                        <RenderNode parent={self} id={id} key={id} />
                        {node.kind === 'smooshed' || node.kind === 'spaced' ? null : ', '}
                    </span>
                ) : (
                    <RenderNode parent={self} id={id} key={id} />
                ),
            );
            if (node.kind === 'smooshed') {
                return (
                    <span ref={drag.ref(node.loc)} style={style}>
                        {children}
                    </span>
                );
            }
            if (node.kind === 'spaced') {
                return (
                    <span ref={drag.ref(node.loc)} style={style}>
                        {interleaveF(children, (k) => (
                            <span key={k}>&nbsp;</span>
                        ))}
                    </span>
                );
            }
            return (
                <span ref={drag.ref(node.loc)} style={style}>
                    {has('before') ? <Cursor /> : null}
                    {opener[node.kind]}
                    {has('inside') ? <Cursor /> : null}
                    {node.forceMultiline ? children : interleaveF(children, (k) => <span key={k}>, </span>)}
                    {closer[node.kind]}
                    {has('after') ? <Cursor /> : null}
                </span>
            );
    }
};
export const RenderNode = ({ id, parent }: { id: string; parent: Path }) => {
    const self = useMemo(() => pathWithChildren(parent, id), [parent, id]);
    const { node, sel } = useContext(UseNodeCtx)(self);

    return (
        <>
            {/* {sel ? <span style={{ fontSize: '50%', border: '1px solid red' }}>{JSON.stringify(sel)}</span> : null} */}
            <R node={node} self={self} sel={sel} />
        </>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
    );
};
