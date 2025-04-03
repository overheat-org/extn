import { InteractionExecutor } from 'diseact';
import { FlameClient } from '@flame-oh/core';

/** 
 * @comptime ENV
 */

/**
 * @comptime INTENTS
 * Get intents of discord client
 */

const executor = new InteractionExecutor();

const client = new FlameClient({ intents });
import('./commands.js').then(m => {
    const map = m.default;
    executor.putCommands(map.values);
});

client.on('interactionCreate', i => {
    if(!i.isChatInputCommand() && !i.isAutocomplete()) return;
    
    executor.run(i);
})

/**
 * @comptime MANAGERS
 * Inject managers instances marked with inject decorator
 */

client.login(process.env.TOKEN);