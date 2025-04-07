import React, { useMemo } from 'react';
import { Scheme, Subst, builtinEnv, schemeApply } from '../infer/algw/algw-s2-return';
import { Ctx, NodeClick } from './App';
import { colors, RenderScheme } from './RenderType';
import { Type } from '../infer/algw/Type';

export type Tenv = {
    scope: Record<string, { scheme: Scheme; source: any }>;
    constructors: Record<string, { free: string[]; args: Type[]; result: Type }>;
    types: Record<string, { free: number; constructors: string[] }>;
    aliases: Record<string, { args: string[]; body: Type }>;
};

export const ShowScope = ({
    smap,
    scope,
    highlightVars,
    ctx,
}: {
    ctx?: { onClick(evt: NodeClick): void };
    smap: Subst;
    scope: Tenv['scope'];
    highlightVars: string[];
}) => {
    const keys = Object.keys(scope);
    const firstNonBuiltin = useMemo(() => keys.findIndex((k) => !builtinEnv().scope[k]), [scope]);
    return (
        <div
            style={{
                border: `1px solid ${colors.accent}`,
                textAlign: 'center',
                width: 400,
            }}
        >
            <div
                style={{ backgroundColor: colors.accent, color: 'black', gridColumn: '1/3', marginBottom: 8, fontFamily: 'Lora', fontWeight: 'bold' }}
            >
                Scope
            </div>
            {!Object.keys(scope).length ? (
                <div
                    style={{
                        marginTop: 24,
                        marginBottom: 16,
                    }}
                >
                    No variables defined
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        // marginTop: 24,
                        marginBottom: 16,
                        gridTemplateColumns: 'max-content 1fr',
                        gridTemplateRows: 'max-content',
                        fontFamily: 'Jet Brains',
                        columnGap: 12,
                        minWidth: 200,
                    }}
                >
                    <div style={{ gridColumn: '1/3', marginBottom: 16, fontFamily: 'Lora', textAlign: 'left', marginLeft: 16 }}>Builtins</div>
                    {keys.map((k) => (
                        <div key={k} style={{ display: 'contents' }}>
                            {k === keys[firstNonBuiltin] ? (
                                <>
                                    <div
                                        style={{
                                            gridColumn: '1/3',
                                            height: 1,
                                            backgroundColor: colors.accent,
                                            marginTop: 8,
                                            marginBottom: 8,
                                        }}
                                    ></div>
                                    <div style={{ gridColumn: '1/3', marginBottom: 16, fontFamily: 'Lora', textAlign: 'left', marginLeft: 16 }}>
                                        Locals
                                    </div>
                                </>
                            ) : null}
                            <div style={{ textAlign: 'right', marginLeft: 16 }}>{k}</div>
                            <div style={{ textAlign: 'left' }}>
                                <RenderScheme
                                    s={schemeApply(smap, scope[k].scheme)}
                                    highlightVars={highlightVars}
                                    onClick={(name) => ctx?.onClick({ type: 'var', name })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
