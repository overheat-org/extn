import { Client, TextChannel } from "discord.js";
import { render, useState } from "diseact";
import { Keyv, autoincrement } from '../../../';
import { plus } from '@utils/math';

const db = new Keyv('meta');

@inject
class Init {
    @event
    async OnceReady() {
        console.log('READY');

        const r = plus(5, await db.get('meta') ?? 0);
        
        await db.set('meta', r);
        
        console.log(r);

        const channel = this.client.guilds.cache.first()!.channels.cache.find(c => c.id == '1260342618743767171')!;

        render(channel as TextChannel, <Counter />)
    }

    constructor(private client: Client) {}
}

function Counter() {
    const [count, setCount] = useState(0);

    const handleIncrement = () => {
        setCount(c => c + 1);
    }

    const handleDecrement = () => {
        setCount(c => c - 1);
    }

    return <message>
        <embed>
            <title>Counter</title>
            <description>Count: {count}</description>
        </embed>

        <button
            isSuccess
            label='+'
            onClick={handleIncrement}
        />

        <button
            isDanger
            label='-'
            onClick={handleDecrement}
        />
    </message>
}

export default Init;