import React, { useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { useHash } from '../useHash';

const getRoot = (): Root => {
    return window._root ?? (window._root = createRoot(document.getElementById('root')!));
};

// So, here's the plan, king.
// We have a module listing down the left.
