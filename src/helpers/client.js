import { FlameClient } from '@flame-oh/core';

const { TOKEN } = process.env;

const client = new FlameClient({ intents: INTENTS });
import('./commands');

MANAGERS

client.login(TOKEN);