import React from 'react';
import { colors } from './RenderType';

export const Numtip = ({ n, inline, final }: { n: number; inline?: boolean; final?: boolean }) => {
    const size = 10;
    // if (1) return null;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={32}
            height={32}
            style={
                inline
                    ? {
                          position: 'absolute',
                          zIndex: 20,
                          opacity: final === false ? 0.3 : 1,
                          top: -32,
                          left: -16,
                      }
                    : { display: 'inline-block' }
            }
        >
            <path
                d={`M16,3C10.5,3,6,7.5,6,13c0,8.4,9,15.5,9.4,15.8c0.2,0.1,0.4,0.2,0.6,0.2s0.4-0.1,0.6-0.2C17,28.5,26,21.4,26,13
	C26,7.5,21.5,3,16,3z`}
                stroke={colors.accent}
                strokeWidth={2}
                style={{
                    fill: colors.accent, // 'rgb(195 24 0)',
                }}
            />
            <text x={16} y={20} fill="black" textAnchor="middle" fontFamily="Jet Brains" fontWeight="bold">
                {n}
            </text>
        </svg>
    );
};
