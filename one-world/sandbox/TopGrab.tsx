import { css } from 'goober';
import React from 'react';
import { useState } from 'react';
import { useUpdate } from './Editor';
import { currentTheme } from './themes';
import { zedlight } from './zedcolors';

export const TopGrab = ({ name, id }: { name: string; id: string }) => {
    const update = useUpdate();
    const [menu, setMenu] = useState(false);
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
