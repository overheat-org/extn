Object.assign(global, { 
    DISEACT_COMMAND_MAP: new Map(), 
    DISEACT_CURRENT_STATE_HOOK: { component: undefined, index: 0 } 
});

import './structures';
import './client';