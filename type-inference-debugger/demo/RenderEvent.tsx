import React from 'react';
import { Event, getGlobalState } from '../infer/algw/algw-s2-return';
import { RenderType } from './RenderType';
import { ShowUnify } from './ShowUnify';

export const RenderEvent = ({ event, hv, onClick }: { onClick(vname: string): void; hv: string[]; event: Event }) => {
    switch (event.type) {
        case 'new-var':
            return (
                <span>
                    New Variable {event.name}
                    <div>{JSON.stringify(getGlobalState().tvarMeta[event.name])}</div>
                </span>
            );
        case 'infer':
            return (
                <span>
                    Inferred {JSON.stringify(event.src)} <RenderType onClick={onClick} t={event.value} highlightVars={hv} />
                </span>
            );
        case 'unify':
            return (
                <ShowUnify
                    message={event.message}
                    oneName={event.oneName}
                    twoName={event.twoName}
                    one={event.one}
                    two={event.two}
                    onClick={onClick}
                    subst={event.subst}
                    hv={hv}
                />
                // <div>
                //     <div>
                //         <RenderType t={event.one} />
                //     </div>
                //     <div>
                //         <RenderType t={event.two} />
                //     </div>
                //     <div>
                //         {Object.entries(event.subst).map(([key, type]) => (
                //             <div key={key}>
                //                 {key} : <RenderType t={type} />
                //             </div>
                //         ))}
                //     </div>
                // </div>
            );
        case 'scope':
            return <span>scope</span>;
    }
};
