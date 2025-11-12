import * as vite from 'vite';
import Scanner from './scanner';

class Compiler {
    scanner = new Scanner();

    async build(cwd = process.cwd()) {
        const config = await this.scanner.scanRootModule(cwd);
        await vite.build(config.vite);
    }
}

export default Compiler;
