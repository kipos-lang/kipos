import React from 'react';
import { interleaveF } from '../../keyboard/interleave';
import { lightColor } from '../../keyboard/ui/colors';
import { Cursor } from '../../keyboard/ui/cursor';
import { opener, closer } from '../../keyboard/ui/RenderNode';
import { Path, ListWhere } from '../../keyboard/utils';
import { Node } from '../../shared/cnodes';
import { useDrag } from '../Editor';
import { RenderNode } from './RenderNode';
import { SelStatus } from '../store/store';

export const RenderTable = ({ node, sel, self }: { node: Node & { type: 'table' }; sel?: SelStatus; self: Path }) => {
    const has = (where: ListWhere) => sel?.cursors.some((c) => c.type === 'list' && c.where === where);

    const hl = sel?.highlight?.type === 'full' || (sel?.highlight?.type === 'list' && sel.highlight.opener && sel.highlight.closer);
    const style = hl ? { borderRadius: '2px', backgroundColor: lightColor, outline: `2px solid ${lightColor}` } : undefined;

    const drag = useDrag();

    if (typeof node.kind !== 'string') return 'UK';

    const rows = node.rows.map((row, i) => (
        <React.Fragment key={`r-${i}`}>
            {interleaveF(
                row.map((id, j) => (
                    <span
                        key={id}
                        style={{
                            gridColumn: j * 2 + 1,
                            gridRow: i + 1,
                        }}
                    >
                        <RenderNode parent={self} id={id} />
                    </span>
                )),
                (j) => (
                    <span key={j} style={{ gridColumn: j * 2 + 2, gridRow: i + 1 }}>
                        :{' '}
                    </span>
                ),
            )}
        </React.Fragment>
    ));

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

    return (
        <span ref={drag.ref(node.loc)} style={style}>
            {has('before') ? <Cursor /> : null}
            {opener[node.kind]}:{has('inside') ? <Cursor /> : null}
            {node.forceMultiline ? (
                <div style={{ display: 'grid', marginLeft: 32, gridAutoColumns: 'max-content', columnGap: 8 }}>{rows}</div>
            ) : (
                interleaveF(rows, (k) => <span key={k}>; </span>)
            )}
            :{closer[node.kind]}
            {has('after') ? <Cursor /> : null}
        </span>
    );
};
