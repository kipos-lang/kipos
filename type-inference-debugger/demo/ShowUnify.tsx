import React, { useState } from 'react';
import { Subst, typeApply } from '../infer/algw/algw-s2-return';
import { Type } from '../infer/algw/Type';
import { colors, RenderType } from './RenderType';

export const ShowUnify = ({
    one,
    two,
    oneName,
    twoName,
    subst,
    message,
    first,
    hv,
    onClick,
}: {
    one: Type;
    two: Type;
    subst: Subst;
    oneName: string;
    twoName: string;
    message?: string;
    first?: boolean;
    hv: string[];
    onClick(vname: string): void;
}) => {
    const [playByPlay, setPlayByPlay] = useState(null as null | number);

    const keys = Object.keys(subst).sort();
    if (playByPlay == null) {
        hv = Object.keys(subst);
        if (!first) {
            one = typeApply(subst, one);
            two = typeApply(subst, two);
        }
    } else {
        hv = [];
        for (let i = 0; i < keys.length * 2 && i < playByPlay; i++) {
            const k = keys[(i / 2) | 0];
            hv = [k];
            if (i % 2 === 1) {
                one = typeApply({ [k]: subst[k] }, one);
                two = typeApply({ [k]: subst[k] }, two);
            }
        }
        if (playByPlay > keys.length * 2) {
            hv = [];
        }
    }

    return (
        <div
            style={{
                border: `1px solid ${colors.accent}`,
                textAlign: 'center',
                display: 'inline-grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: 8,
            }}
            onClick={() => setPlayByPlay(playByPlay == null ? 0 : playByPlay > keys.length * 2 ? null : playByPlay + 1)}
        >
            <div style={{ minWidth: 0, gridColumn: '1/3' }}>{message}</div>
            <div
                style={{ backgroundColor: colors.accent, color: 'black', gridColumn: '1/3', marginBottom: 8, fontFamily: 'Lora', fontWeight: 'bold' }}
            >
                unify
            </div>
            {/* <div style={{ display: 'contents' }}> */}
            <span style={{ textAlign: 'right', marginLeft: 8, fontFamily: 'Lora', fontStyle: 'italic' }}>{oneName}</span>
            <div style={{ textAlign: 'left', marginRight: 8 }}>
                <RenderType t={one} highlightVars={hv} onClick={onClick} />
            </div>
            {/* </div> */}
            <div
                style={{ backgroundColor: colors.accent, color: 'black', gridColumn: '1/3', marginBlock: 8, fontFamily: 'Lora', fontWeight: 'bold' }}
            >
                with
            </div>
            {/* <div> */}
            <span style={{ textAlign: 'right', marginLeft: 8, fontFamily: 'Lora', fontStyle: 'italic' }}>{twoName}</span>
            <div style={{ textAlign: 'left', marginRight: 8 }}>
                <RenderType t={two} highlightVars={hv} onClick={onClick} />
            </div>
            {/* </div> */}
            <div
                style={{ backgroundColor: colors.accent, color: 'black', gridColumn: '1/3', marginBlock: 8, fontFamily: 'Lora', fontWeight: 'bold' }}
            >
                substitutions:
            </div>
            <div
                style={{
                    display: 'grid',
                    gridColumn: '1/3',
                    gridTemplateColumns: '1fr max-content max-content max-content 1fr',
                    rowGap: 8,
                    columnGap: 8,
                    paddingBottom: 8,
                }}
            >
                {keys.map((key) => (
                    <div key={key} style={{ display: 'contents' }}>
                        <div />
                        <RenderType t={{ type: 'var', name: key, src: { left: 'unknown' } }} highlightVars={hv} onClick={onClick} />
                        <div>{'->'}</div>
                        <RenderType t={subst[key]} highlightVars={hv} onClick={onClick} />
                        <div />
                    </div>
                ))}
            </div>
        </div>
    );
};
