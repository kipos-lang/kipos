import React from 'react';
import { StackText, Subst, typeApply } from '../infer/algw/algw-s2-return';
import { Frame } from './App';
import { Numtip } from './Numtip';
import { colors, RenderType } from './RenderType';
import { ShowUnify } from './ShowUnify';
import { currentTheme } from './themes';

export const ShowText = ({ text, subst, hv, onClick }: { onClick(vname: string): void; hv: string[]; text: StackText; subst: Subst }) => {
    if (typeof text === 'string') return text;
    switch (text.type) {
        case 'hole':
            return (
                <span
                    style={{
                        display: 'inline-block',
                        border: `1px solid ${currentTheme.typeColors.accent}`,
                        background: text.active ? currentTheme.typeColors.accent : 'transparent',
                        borderRadius: 3,
                        width: '1em',
                        height: '26px',
                        marginBottom: -7,
                    }}
                />
            );
        case 'kwd':
            return <span style={{ color: colors.con }}>{text.kwd}</span>;
        case 'type':
            return (
                <span
                    style={{
                        border: `1px solid ${currentTheme.typeColors.accent}`,
                        borderRadius: 3,
                        display: 'inline-block',
                        padding: '0px 4px',
                    }}
                >
                    <RenderType t={text.noSubst ? text.typ : typeApply(subst, text.typ)} highlightVars={hv} onClick={onClick} />
                </span>
            );
    }
};

export const ShowStacks = ({
    stack,
    subst,
    hv,
    onClick,
    showTips,
}: {
    showTips: boolean;
    onClick(vname: string): void;
    hv: string[];
    subst: Subst;
    stack?: Frame;
}) => {
    if (!stack) return null;
    return (
        <div>
            <div style={{ marginBottom: 12, fontFamily: 'Jet Brains' }}>
                {stack.stack.map((item, j) => {
                    if (item.type === 'unify') {
                        return (
                            <ShowUnify
                                key={j}
                                onClick={onClick}
                                oneName={item.oneName}
                                twoName={item.twoName}
                                message={item.message}
                                one={item.one}
                                two={item.two}
                                subst={item.subst}
                                first={item.first}
                                hv={hv}
                            />
                        );
                    }
                    return (
                        <div key={j} style={{ marginBottom: 10 }}>
                            {showTips ? <Numtip n={j + 1} /> : null}
                            {item.text.map((t, i) => (
                                <ShowText subst={subst} text={t} key={i} hv={hv} onClick={onClick} />
                            ))}
                        </div>
                    );
                })}
                <div>
                    <div
                        style={{
                            fontFamily: 'Lora',
                            fontSize: '120%',
                            marginTop: 12,
                            backgroundColor: colors.accent,
                            color: 'black',
                            padding: '4px 8px',
                            borderRadius: 4,
                            display: 'inline-block',
                        }}
                    >
                        {stack.title}
                    </div>
                </div>
            </div>
        </div>
    );
};
