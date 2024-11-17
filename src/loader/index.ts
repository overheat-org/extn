import CommandsLoader from "./commands";
import ManagersLoader from "./managers";
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
        await this.commands.loadCommandsDir();
        return await this.managers.loadManagersDir();
    }

    commands: CommandsLoader;
    managers: ManagersLoader;

    constructor(config: Config) {
        this.commands = new CommandsLoader(config);
        this.managers = new ManagersLoader(config);
    }
}

export default Loader;