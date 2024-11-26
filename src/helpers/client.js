import { FlameClient } from '@flame-oh/core';
import _commands from './commands';

const { TOKEN } = process.env;

void async function () {
    const module = await _commands;
    await Promise.all(Object.values(module));
}();

const client = new FlameClient({ intents: INTENTS });

MANAGERS

client.login(TOKEN);