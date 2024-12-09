import ImportRegistry, { ImportResolver } from "./import-registry";
import CommandsLoader from "./commands";
import ManagersLoader from "./managers";
import ClientLoader from './client';
import CommonLoader from "./common";
import Config from "../config";

class Loader {
    extensions = ['.ts', '.tsx'];
    
    async run() {
        // Don't reorder
        await this.common.load();
        await this.managers.load();
        await this.client.load();
        await this.commands.load();
    }

    /**
     * Generates an index that merges client instantiation and internal managers
     */
    client: ClientLoader;

    /**
     * Merges all commands encountered in one file
     */
    commands: CommandsLoader;

    /**
     * Merges each manager dir in one file  
     */
    managers: ManagersLoader;

    /**
     * Just load common directories and files like utils, and others.
     */
    common: CommonLoader;

    /**
     * Register all imports of loader, and 
     */
    // importResolver: ImportResolver;

    constructor(config: Config, dev: boolean) {
        ImportRegistry.init(config);
        
        // this.importResolver = new ImportResolver(config);
        this.client = new ClientLoader(config);
        this.common = new CommonLoader(config, this);
        this.commands = new CommandsLoader(config, dev);
        this.managers = new ManagersLoader(config, this);
    }
}

export default Loader;