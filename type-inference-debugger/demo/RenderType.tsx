import React from 'react';
import { Scheme } from '../infer/algw/algw-s2-return';
import { Type } from '../infer/algw/Type';
import { interleave } from './interleave';
import { currentTheme } from './themes';
// import { hlNode } from './App';

export const colors = currentTheme.typeColors;
//     {
//     accent: '#aaf',
//     accentLight: '#aaf',
//     accentLightRgba: 'rgba(170, 170, 255, 0.3)',
//     punct: '#555',
//     vbl: '#afa',
//     con: '#aaf',
//     hl: '#aaf', //'rgb(237 255 0)',
// };
const bgbg = 'rgb(206 206 249)'; //colors.accentLightRgba,

export const hlShadow: React.CSSProperties = {
    // background: colors.hl, //'#550',
    // color: colors.hlColor,
    // padding: '0 2px 0 0',
    // lineHeight: '18px',

    // // borderRadius: '50%',
    // borderRadius: 4,
    // display: 'inline-block',
    // border: '1px solid ' + colors.hl,
    background: bgbg,
    position: 'relative',
    zIndex: 10,

    borderRadius: 4,
    boxShadow: `
    2px 2px 0 ${bgbg},
    -2px -2px 0 ${bgbg},
    2px -2px 0 ${bgbg},
    -2px 2px 0 ${bgbg},
    0px 4px 0 ${colors.accent},
    0px -4px 0 ${colors.accent},
    4px 4px 0 ${colors.accent},
    -4px 4px 0 ${colors.accent},
    4px -4px 0 ${colors.accent},
    -4px -4px 0 ${colors.accent}
    `,
};

export const RenderScheme = ({ s, highlightVars, onClick }: { s: Scheme; highlightVars: string[]; onClick(vname: string): void }) => {
    if (!s.vars.length) return <RenderType t={s.body} highlightVars={highlightVars} onClick={onClick} />;
    highlightVars = highlightVars.filter((h) => !s.vars.includes(h));
    return (
        <span>
            &lt;
            {s.vars.map((v, i) => (
                <RenderType t={{ type: 'var', name: v, src: { left: '' } }} key={i} highlightVars={[]} onClick={onClick} />
            ))}
            &gt;
            <RenderType t={s.body} highlightVars={highlightVars} onClick={onClick} />
        </span>
    );
};

export const RenderType = ({ t, highlightVars, onClick }: { t: Type; highlightVars: string[]; onClick(vname: string): void }) => {
    switch (t.type) {
        case 'var':
            return (
                <span
                    style={{
                        fontStyle: 'italic',
                        borderRadius: 6,
                        lineHeight: '18px',
                        display: 'inline-block',
                        border: '1px solid transparent',
                        color: colors.vbl,
                        cursor: 'pointer',
                        padding: '0 2px 0 0',
                        ...(highlightVars.includes(t.name) ? hlShadow : undefined),
                    }}
                    onClick={() => onClick(t.name)}
                >
                    {t.name}
                </span>
            );
        case 'fn':
            return (
                <span style={{ color: colors.punct }}>
                    {'('}
                    {interleave(
                        t.args.map((arg, i) => <RenderType t={arg} key={i} highlightVars={highlightVars} onClick={onClick} />),
                        (i) => (
                            <span key={`sep-${i}`}>,&nbsp;</span>
                        ),
                    )}
                    {') => '}
                    <RenderType t={t.result} highlightVars={highlightVars} onClick={onClick} />
                </span>
            );
        case 'app':
            const args: Type[] = t.args;
            let target = t.target;
            // while (target.type === 'app') {
            //     args.unshift(target.arg);
            //     target = target.target;
            // }
            if (target.type === 'con' && target.name === ',') {
                return (
                    <span style={{ color: colors.punct }}>
                        (
                        {interleave(
                            args.map((a, i) => <RenderType key={i} t={a} highlightVars={highlightVars} onClick={onClick} />),
                            (i) => (
                                <span key={'c-' + i}>, </span>
                            ),
                        )}
                        )
                    </span>
                );
            }
            return (
                <span style={{ color: colors.punct }}>
                    <RenderType t={target} highlightVars={highlightVars} onClick={onClick} />
                    &lt;
                    {interleave(
                        args.map((a, i) => <RenderType key={i} t={a} highlightVars={highlightVars} onClick={onClick} />),
                        (i) => (
                            <span key={'c-' + i}>, </span>
                        ),
                    )}
                    &gt;
                </span>
            );
        case 'con':
            return <span style={{ color: colors.con }}>{t.name}</span>;
    }
};
