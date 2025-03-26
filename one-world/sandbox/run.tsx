import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { App } from './App';

const getRoot = (): Root => {
    return window._root ?? (window._root = createRoot(document.getElementById('root')!));
};

// So, here's the plan, king.
// We have a module listing down the left.
getRoot().render(<App />);
