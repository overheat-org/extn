import CommandsLoader from "./commands";
import ManagersLoader from "./managers";
import ClientLoader from './client';
import Config from "../config";

export interface ImportInfo {
    source: string;
    specifiers: {
        local: string;
        imported?: string;
    }[];
}

class Loader {
    async run() {
        const internalManagers = await this.managers.load();
        await this.client.load(internalManagers);
        await this.commands.load();
    }

    client: ClientLoader;
    commands: CommandsLoader;
    managers: ManagersLoader;

    constructor(config: Config, dev: boolean) {
        this.client = new ClientLoader(config);
        this.commands = new CommandsLoader(config, dev);
        this.managers = new ManagersLoader(config, this.commands);
    }
}

export default Loader;