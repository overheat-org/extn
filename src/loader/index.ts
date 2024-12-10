import ImportRegistry, { ImportResolver } from "./import-registry";
import CommandsLoader from "./commands";
import ManagersLoader from "./managers";
import ClientLoader from './client';
import CommonLoader from "./common";
import Config from "../config";
import Scanner from "./scanner";

class Loader {
    extensions = ['.ts', '.tsx'];
    
    async run() {
        // Don't reorder
        const parseTree = await this.scanner.run();
        
        await this.common.load(parseTree);
        await this.managers.load(parseTree);
        await this.client.load();
        await this.commands.load(parseTree);
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
    importResolver: ImportResolver;

    /**
     * a
     */
    scanner: Scanner

    constructor(config: Config, dev: boolean) {
        this.importResolver = new ImportResolver(config);
        this.scanner = new Scanner(config, this.importResolver);
        this.client = new ClientLoader(config, this);
        this.common = new CommonLoader(config, this);
        this.commands = new CommandsLoader(config, this, dev);
        this.managers = new ManagersLoader(config, this);
    }
}

export default Loader;