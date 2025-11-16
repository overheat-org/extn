import { Client } from "discord.js";
import { useState } from "extn/hooks";
import { Manager, Storage } from 'extn';
import { Payment } from './Payment';
const meta = new Storage('meta');

@Service
export class Init {
    @event
    async OnceReady() {
        console.log(`READY AT ${this.client.user.tag}`);
    }
    constructor(private client: Client, private payment: Payment) {
		this.client.once('OnceReady', this.OnceReady.bind(this));
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