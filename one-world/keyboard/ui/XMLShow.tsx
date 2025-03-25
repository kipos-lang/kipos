import React, { useMemo, useState, useLayoutEffect } from 'react';
import { Loc } from '../../shared/cnodes';
import { XML } from '../../syntaxes/xml';
import { selectStart } from '../handleNav';
import { Src, allPaths } from '../handleShiftNav';
import { TestState } from '../test-utils';
import { Update } from '../utils';
import { walxml, collides } from './App';

const XMLShow = ({
    xml,
    refs,
    state,
    spans,
    dispatch,
}: {
    spans: Src[];
    state: TestState;
    xml: XML;
    refs: Record<string, HTMLElement>;
    dispatch: (up: Update | void) => void;
}) => {
    const alls = useMemo(() => {
        const lst: XML[] = [];
        walxml(xml, (m) => {
            if (!m.src) return;
            if (m.src.right || state.top.nodes[m.src.left[0].idx].type !== 'id') {
                lst.push(m);
            }
        });
        return lst;
    }, [xml, state]);

    const pos = (loc: Loc, right?: Loc): [number, number] | null => {
        const lf = refs[loc[0].idx];
        if (!lf) return null;
        const lb = lf.getBoundingClientRect();
        if (!right) {
            return [lb.left, lb.right];
        }
        const rf = refs[right[0].idx];
        if (!rf) return null;
        const rb = rf.getBoundingClientRect();
        return [lb.left, rb.right];
    };

    const calc = () => {
        const posed = spans
            .map((src) => {
                const { left, right } = src;
                // const { left, right } = node.src;
                if (!right) return null;
                const sides = pos(left, right);
                if (!sides) return null;
                return { sides, span: { left, right } };
            })
            .filter(Boolean) as { sides: [number, number]; node?: XML; span: Src }[];
        posed.sort((a, b) => a.sides[1] - a.sides[0] - (b.sides[1] - b.sides[0]));

        const placed: { node?: XML; sides: [number, number]; span: Src }[][] = [[]];
        posed.forEach(({ node, sides, span }) => {
            for (let i = 0; i < placed.length; i++) {
                const row = placed[i];
                if (!row.some((one) => collides(one.sides, sides))) {
                    row.push({ node, sides, span });
                    return;
                }
            }
            placed.push([{ node, sides, span }]);
        });
        return placed;
    };
    const [placed, setPlaced] = useState<{ node?: XML; sides: [number, number]; span: Src }[][]>([]);
    useLayoutEffect(() => {
        // setTimeout(() => {
        setPlaced(calc());
        // }, 10);
    }, [state, xml]);

    const h = 14;

    return (
        <div>
            {placed.map((row, i) => {
                return (
                    <div key={i} style={{ position: 'relative', height: h + 2 }}>
                        {row.map(({ node, sides, span }, j) => {
                            return (
                                <div
                                    key={j}
                                    onClick={() => {
                                        const all = allPaths(state.top);
                                        const st = all[span.left[0].idx];
                                        if (!span.right) {
                                            return;
                                        }
                                        const ssel = selectStart(st, state.top);
                                        if (!ssel) return;

                                        const ed = all[span.right[0].idx];
                                        dispatch({
                                            nodes: {},
                                            selection: {
                                                start: ssel,
                                                // multi: { end: selEnd(ed) },
                                            },
                                        });
                                        console.log(span, all[span.left[0].idx]);
                                        state.top;
                                    }}
                                    style={{
                                        position: 'absolute',
                                        left: sides[0],
                                        width: sides[1] - sides[0],
                                        backgroundColor: 'rgba(200,200,255)',
                                        marginTop: 2,
                                        height: h,
                                        // height: 4,
                                        // fontSize: 8,
                                        borderRadius: 4,
                                        // padding: 2,
                                    }}
                                >
                                    {node?.tag}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};
