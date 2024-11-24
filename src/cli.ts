import { join as j } from 'path/posix';
import { program } from 'commander';
import build from './compilation/build';
import execute from './compilation/execute';
import Config from './config';

const config = Config.getInstance(j(process.cwd(), 'flamecore.config.js'))

program.command('dev')
    .description('Run on dev mode, watch is enable')
    .action(() => {
        build(config, true);
    })

program.command('build')
    .description('Build project to optimized program')
    .action(() => {
        build(config, false);
    })

program.command('start')
    .description("Run build")
    .action(() => {
        execute(config, false);
    })

program.parse();