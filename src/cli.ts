import { program } from 'commander';
import build from './compilation/build';
import execute from './compilation/execute';

program.command('dev')
    .description('Run on dev mode, watch is enable')
    .action(() => {
        build(process.cwd(), true);
    })

program.command('build')
    .description('Build project to optimized program')
    .action(() => {
        build(process.cwd(), false);
    })

program.command('start')
    .description("Run build")
    .action(() => {
        execute(process.cwd(), false);
    })

program.parse();