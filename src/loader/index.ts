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
        const { internalManagers } = await this.managers.loadManagersDir();
        await this.client.load(internalManagers);
        await this.commands.loadCommandsDir();
    }

    client: ClientLoader;
    commands: CommandsLoader;
    managers: ManagersLoader;

    constructor(config: Config) {
        this.client = new ClientLoader(config);
        this.commands = new CommandsLoader(config);
        this.managers = new ManagersLoader(config);
    }
}

export default Loader;