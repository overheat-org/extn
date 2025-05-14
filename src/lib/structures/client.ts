import { Client, ClientOptions as _ClientOptions } from "discord.js";
import { InteractionExecutor } from "diseact";
import { CommandRegister } from "../internal";

interface ClientOptions extends _ClientOptions {
    commands: Promise<{ default: CommandRegister }>,
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
            const register = mod.default as CommandRegister;
            this.executor.commandMap = register.map;
            this.onReady().then(async () => {
                let guild = process.env.GUILD_ID ? this.guilds.cache.get(process.env.GUILD_ID) : undefined;

    
                if(guild) {
                    await guild.commands.set(register.list);
                }
                else {
                    await this.application?.commands.set(register.list);
                }
            });
        });

        queueMicrotask(() => {
            for(const arg of options.managers) {
                new arg(this);
            }
        });
        
    }

    public login(): Promise<string> {
        return super.login(process.env.TOKEN);
    }
}