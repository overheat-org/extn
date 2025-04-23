import { Client, ClientOptions as _ClientOptions } from "discord.js";
import { InteractionExecutor } from "diseact";

interface ClientOptions extends _ClientOptions {
    commands: Promise< { default: { values: any } }>
    managers: any[]
}

export class FlameClient extends Client {
    private executor = new InteractionExecutor();
    
    async onReady() {
        const { promise, resolve } = Promise.withResolvers();

        this.once('ready', resolve);

        return await promise;
    }

    constructor(options: ClientOptions) {
        super(options);

        this.on('interactionCreate', i => {
            if(!i.isChatInputCommand() && !i.isAutocomplete()) return;
            
            this.executor.run(i);
        });

        options.commands.then(mod => {
            const map = mod.default;
            this.executor.putCommands(map);
        });
        
        for(const arg of options.managers) {
            new arg(this);
        }
    }

    public login(): Promise<string> {
        return super.login(process.env.TOKEN);
    }
}