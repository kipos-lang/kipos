import React, { useContext } from 'react';
import { interleaveF } from '../../keyboard/interleave';
import { lightColor } from '../../keyboard/ui/colors';
import { Cursor } from '../../keyboard/ui/cursor';
import { opener, closer } from '../../keyboard/ui/RenderNode';
import { Path, ListWhere } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { useDrag } from '../useProvideDrag';
import { RenderNode } from './RenderNode';
import { SelStatus } from '../store/store';
import { currentTheme } from '../themes';
import { Meta } from '../store/language';
import { metaStyles } from './metaStyles';
import { posInList } from '../../keyboard/ui/selectionPos';
import { GetTopCtx } from '../Top';

export const RenderTable = ({ node, sel, self, meta }: { meta?: Meta; node: Node & { type: 'table' }; sel?: SelStatus; self: Path }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);

    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    let style: undefined | React.CSSProperties = hl
        ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` }
        : undefined;
    if (meta?.kind && metaStyles[meta.kind as 'ref']) {
        style = { ...style, ...metaStyles[meta.kind as 'ref'] };
    }

    const drag = useDrag();

    if (typeof node.kind !== 'string') return 'UK';

    const width = node.rows.reduce((m, r) => Math.max(m, r.length), 0);

    let rat = 0;
    const rows = node.rows.map((row, i) => {
        let at = rat++;
        return (
            <React.Fragment key={`r-${i}`}>
                {interleaveF(
                    row.map((id, j) => (
                        <span
                            key={id}
                            style={
                                node.forceMultiline === 'indent-last' && j === width - 1
                                    ? {
                                          gridRow: rat++ + 1,
                                          gridColumn: `1 / ${width + 2}`,
                                          // display: 'block',
                                          paddingLeft: 32,
                                          paddingBottom: 8,
                                          borderBottom: `1px dotted ${currentTheme.typeColors.accent}`,
                                          marginBottom: 8,
                                      }
                                    : {
                                          gridColumn: j * 2 + 1,
                                          gridRow: at + 1,
                                      }
                            }
                        >
                            <RenderNode parent={self} id={id} />
                        </span>
                    )),
                    (j) => (
                        <span key={j} style={{ gridColumn: j * 2 + 2, gridRow: at + 1, ...currentTheme.metaNode.punct }}>
                            :
                        </span>
                    ),
                )}
            </React.Fragment>
        );
    });

    // const children = rows.map((row, i) =>
    //     node.forceMultiline ? (
    //         <span
    //             style={{
    //                 display: 'block',
    //                 paddingLeft: 32,
    //             }}
    //             key={i}
    //         >
    //             {row}
    //         </span>
    //     ) : (
    //         <RenderNode parent={self} id={id} key={id} />
    //     ),
    // );
    const getTop = useContext(GetTopCtx);

    return (
        <span
            ref={drag.ref(node.loc)}
            style={style}
            onMouseDown={(evt) => {
                evt.stopPropagation();
                evt.preventDefault();
                const sel = posInList(self, { x: evt.clientX, y: evt.clientY }, drag.refs, getTop());
                if (sel) {
                    drag.start(sel);
                }
            }}
            onMouseMove={(evt) => {
                if (drag.dragging) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    const sel = posInList(self, { x: evt.clientX, y: evt.clientY }, drag.refs, getTop());
                    if (sel) {
                        drag.move(sel, evt.ctrlKey, evt.altKey);
                    }
                }
            }}
        >
            {has('before') ? <Cursor /> : null}
            {opener[node.kind]}
            <span style={{ marginLeft: -6, position: 'relative', top: '-1px', marginRight: -2 }}>:</span>
            {has('inside') ? <Cursor /> : null}
            {node.forceMultiline ? (
                <div style={{ display: 'grid', marginLeft: 32, gridAutoColumns: 'max-content', columnGap: 8 }}>{rows}</div>
            ) : (
                interleaveF(rows, (k) => <span key={k}>; </span>)
            )}
            <span style={{ marginRight: -7, position: 'relative', top: -1, marginLeft: -2 }}>:</span>
            {closer[node.kind]}
            {has('after') ? <Cursor /> : null}
        </span>
    );
};
