import React from 'react';
import { lightColor } from '../../keyboard/ui/colors';
import { Cursor, TextWithCursor } from '../../keyboard/ui/cursor';
import { Path, ListWhere, selStart } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { splitGraphemes } from '../../splitGraphemes';
import { cursorPositionInSpanForEvt } from '../App';
import { useDrag } from '../Editor';
import { RenderNode } from './RenderNode';
import { SelStatus } from '../store/store';
import { Meta } from '../store/language';
import { metaStyles } from './metaStyles';

export const RenderText = ({ node, sel, self, meta }: { meta?: Meta; self: Path; node: Node & { type: 'text' }; sel?: SelStatus }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);
    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    let style: undefined | React.CSSProperties = hl
        ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` }
        : undefined;
    if (meta?.kind && metaStyles[meta.kind as 'ref']) {
        style = { ...style, ...metaStyles[meta.kind as 'ref'] };
    }

    const drag = useDrag();
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
};
