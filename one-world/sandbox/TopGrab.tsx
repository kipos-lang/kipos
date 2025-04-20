import { css } from 'goober';
import React from 'react';
import { useState } from 'react';
import { useUpdate } from './useProvideDrag';
import { currentTheme } from './themes';
import { zedlight } from './zedcolors';
import { useTopResults } from './store/editorHooks';

export const TopGrab = ({ name, id }: { name: string; id: string }) => {
    const update = useUpdate();
    const [menu, setMenu] = useState(false);
    const results = useTopResults(id);
    const hasTests = results?.some((t) => t.type === 'test-result');
    const hasFailures = results?.some((t) => t.type === 'test-result' && t.result.type !== 'pass');
    return (
        <div style={{ position: 'relative' }}>
            <div
                className={css({
                    borderRadius: '16px',
                    padding: '0 4px',
                    backgroundColor: zedlight['border.selected'],
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    width: '2em',
                    height: '2em',
                    fontSize: '80%',
                    lineHeight: '2em',
                })}
                style={
                    hasFailures
                        ? {
                              backgroundColor: zedlight.syntax['punctuation.special'].color,
                              color: 'white',
                          }
                        : hasTests
                          ? {
                                backgroundColor: zedlight.syntax['constant'].color,
                                color: 'white',
                            }
                          : undefined
                }
                onClick={() => setMenu(!menu)}
            >
                {name}
            </div>
            {menu ? (
                <div
                    className={css({
                        background: 'white',
                        border: '1px solid #aaa',
                        borderRadius: '4px',
                        position: 'absolute',
                        minWidth: 'max-content',
                        left: 0,
                        top: '100%',
                        marginTop: '8px',
                        zIndex: 100,
                    })}
                >
                    <button
                        onClick={() => {
                            update({ type: 'rm-tl', id });
                        }}
                        className={css({
                            background: 'transparent',
                            '&:hover': {
                                color: 'red',
                            },
                            lineHeight: '18px',
                            border: 'none',
                            color: 'black',
                            cursor: 'pointer',
                        })}
                    >
                        &times; delete toplevel
                    </button>
                </div>
            ) : null}
        </div>
    );
};
