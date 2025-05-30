import React from 'react';
import { splitGraphemes } from '../../splitGraphemes';
import { Id, NodeID } from '../../shared/cnodes';
import { IdCursor, Path, SelectionStatuses, selStart, TmpText } from '../utils';
import { TextWithCursor, Zwd } from './cursor';
import { cursorPositionInSpanForEvt, RCtx } from './RenderNode';

export const RenderId = (
    status: SelectionStatuses[''],
    readOnly: boolean | undefined,
    node: Id<NodeID>,
    style: React.CSSProperties | undefined,
    ref: (el: HTMLElement) => void,
    ctx: RCtx,
    nextParent: Path,
) => {
    if (status?.cursors.length && !readOnly) {
        // STOPSHIP need to render tmpText here
        // const cursorText = tmpText[node.loc]; // (status.cursors.find((c) => c.type === 'id' && c.text) as IdCursor)?.text;
        const text = splitGraphemes(node.text);
        return (
            <span style={{ ...style, position: 'relative' }}>
                <TextWithCursor
                    innerRef={ref}
                    onMouseDown={(evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                        ctx.drag.start(selStart(nextParent, { type: 'id', end: pos ?? 0 }), evt.metaKey);
                    }}
                    onMouseMove={(evt) => {
                        if (ctx.drag.dragging) {
                            evt.preventDefault();
                            evt.stopPropagation();
                            const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, text);
                            ctx.drag.move(selStart(nextParent, { type: 'id', end: pos ?? 0 }), evt.ctrlKey, evt.altKey);
                        }
                    }}
                    text={text}
                    highlight={status.highlight?.type === 'id' ? status.highlight.spans : undefined}
                    cursors={(status.cursors.filter((c) => c.type === 'id') as IdCursor[]).map((c) => c.end)}
                />
            </span>
        );
    }
    let text = node.text;
    return (
        <span
            style={style}
            ref={ref}
            onMouseDown={(evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, splitGraphemes(node.text));
                ctx.drag.start(selStart(nextParent, { type: 'id', end: pos ?? 0 }), evt.metaKey);
            }}
            onMouseMove={(evt) => {
                if (ctx.drag.dragging) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    const pos = cursorPositionInSpanForEvt(evt, evt.currentTarget, splitGraphemes(node.text));
                    ctx.drag.move(selStart(nextParent, { type: 'id', end: pos ?? 0 }), evt.ctrlKey, evt.altKey);
                }
            }}
        >
            {text === '' ? <Zwd /> : text}
        </span>
    );
};
