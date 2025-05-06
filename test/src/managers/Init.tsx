import '@flame-oh/manager-commerce';
import { Client } from "discord.js";
import { useState } from "diseact";
import { Manager, Storage } from '@flame-oh/core';
import { plus } from '@utils/math';
const meta = new Storage('meta');

@inject
export class Init extends Manager {
    @event
    async OnceReady() {
        console.log('READY');
        const r = plus(5, (await meta.get('meta')) ?? 0);
        await meta.set('meta', r);
        console.log(r);

        // const channel = this.client.guilds.cache.first()!.channels.cache.find(c => c.id == '1260342618743767171')!;

        // render(channel as TextChannel, <Counter />)
    }
    constructor(private client: Client) {
        super();
    }
}

function Counter() {
    const [count, setCount] = useState(0);
    const handleIncrement = () => {
        setCount(c => c + 1);
    };
    const handleDecrement = () => {
        setCount(c => c - 1);
    };
    return <message>
        <embed>
            <title>Counter</title>
            <description>Count: {count}</description>
        </embed>

        <button success label='+' onClick={handleIncrement} />

        <button danger label='-' onClick={handleDecrement} />
    </message>;
}