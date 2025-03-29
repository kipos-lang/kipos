import React from 'react';
import { lightColor } from '../../keyboard/ui/colors';
import { TextWithCursor } from '../../keyboard/ui/cursor';
import { Path, selStart, IdCursor } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { splitGraphemes } from '../../splitGraphemes';
import { cursorPositionInSpanForEvt } from '../App';
import { useDrag } from '../Editor';
import { SelStatus } from '../store/store';
import { Meta } from '../store/language';
import { metaStyles } from './metaStyles';

export const RenderId = ({ node, sel, self, meta }: { meta?: Meta; node: Node & { type: 'id' }; sel?: SelStatus; self: Path }) => {
    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    let style: undefined | React.CSSProperties = hl
        ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` }
        : undefined;
    if (meta?.kind && metaStyles[meta.kind as 'ref']) {
        style = { ...style, ...metaStyles[meta.kind as 'ref'] };
    }

    const drag = useDrag();

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
};
