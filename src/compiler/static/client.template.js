import { FlameClient } from '@flame-oh/core';

const { TOKEN } = process.env;

/**
 * @comptime INTENTS
 * Get intents of discord client
 */

const client = new FlameClient({ intents: INTENTS });
import('./commands.js');

/**
 * @comptime MANAGERS
 * Inject managers instances marked with inject decorator
 */

client.login(TOKEN);