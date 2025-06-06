import fs from "fs";
import { Client, ClientOptions, Events } from "discord.js";
import DependencyManager from "../internal/DependencyManager";
import CommandManager from "../internal/CommandManager";
import { CONFIG_PATH } from "../../consts/regex";
import path from "path";

// TODO: definir estrategias para ler o .flame, sem depender de passar no start o path correto.
// 1. Se tiver .flame, TENTAR ler o dependency-graph e o commands
// 2. Se tiver o arquivo de configuração, ler e descobrir o path do .flame

export class FlameClient extends Client {
    private dependencyManager = new DependencyManager();
    private commandManager = new CommandManager();

    constructor(options: ClientOptions) {
        super(options);

        this.on(Events.InteractionCreate, interaction => {
            if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
                this.commandManager.run(interaction);
            }
        });

        this.once(Events.ClientReady, this.onReady);
    }

    private async onReady(): Promise<void> {
        this.commandManager.register(this);
    }

    private async bootstrap(): Promise<void> {      
        const buildPath = await this.getBuildPath();

        await Promise.all([
            this.dependencyManager.resolve(buildPath),
            this.commandManager.load(buildPath)
        ]);
    }

    private async getBuildPath() {
        const cwd = process.cwd();
        const files = await fs.promises.readdir(cwd);
        const configFile = files.find(f => CONFIG_PATH.test(f));

        let buildPath: string | undefined;

        if (configFile) {
            const config = await import(path.resolve(cwd, configFile));
            if (config.buildPath) {
                buildPath = path.resolve(cwd, config.buildPath, ".flame");
            }
        }

        if (!buildPath) {
            const flamePath = path.resolve(cwd, ".flame");

            try {
                fs.promises.access(flamePath);
                buildPath = flamePath;
            }
            catch {
                throw new Error("Cannot find '.flame' directory or valid config file with 'buildPath'.");
            }
        }

        return buildPath;
    }


    public async start(): Promise<string> {
        await this.bootstrap();
        return this.login(process.env.TOKEN!);
    }
}
