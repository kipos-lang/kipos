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

const R = ({ node, self, sel }: { node: Node; self: Path; sel?: SelStatus }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);
    const drag = useDrag();
    switch (node.type) {
        case 'id':
            const text = splitGraphemes(node.text);
            if (!sel)
                return (
                    <span
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
            );
        case 'text':
            return (
                <span ref={drag.ref(node.loc)}>
                    {has('before') ? <Cursor /> : null}"{has('inside') ? <Cursor /> : null}
                    {node.spans.map((span, i) => {
                        const sc = sel?.cursors.filter((c) => c.type === 'text' && c.end.index === i);
                        if (span.type === 'text') {
                            if (sc?.length) {
                                const hl = sel?.highlight?.type === 'text' ? sel.highlight.spans[i] : undefined;
                                return (
                                    <TextWithCursor
                                        key={i}
                                        text={splitGraphemes(span.text)}
                                        highlight={hl}
                                        cursors={sc.map((s) => (s.type === 'text' ? s.end.cursor : 0))}
                                    />
                                );
                            }
                            return span.text;
                        }
                        if (span.type === 'embed') {
                            return <RenderNode key={i} parent={self} id={span.item} />;
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
                return <span ref={drag.ref(node.loc)}>{children}</span>;
            }
            if (node.kind === 'spaced') {
                return (
                    <span ref={drag.ref(node.loc)}>
                        {interleaveF(children, (k) => (
                            <span key={k}>&nbsp;</span>
                        ))}
                    </span>
                );
            }
            return (
                <span ref={drag.ref(node.loc)}>
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
        <R node={node} self={self} sel={sel} />
        // <>
        // <span data-self={JSON.stringify(self)} data-id={id}>
        //     {/* <span style={{ fontSize: '50%', border: '1px solid red' }}>{id.slice(-5)}</span> */}
        //     {/* <span style={{ fontSize: '50%' }}>{pathKey(self)}</span>
        //     {JSON.stringify(sel)} */}
        // {/* </span> */}
        // </>
    );
};
