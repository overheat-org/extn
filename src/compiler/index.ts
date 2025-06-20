import './polyfills';
import fs from 'fs/promises';
import Config from "../config";
import Graph from "./graph";
import Transformer from "./transformer";
import { join, sep } from 'path';
import { Module } from './module';
import Builder from './builder';
import Parser from './parser';
import ImportResolver from './import-resolver';
import AnalyzerRunner from './analyzer';

class Compiler {
    parser: Parser;
    builder: Builder;
    analyzer: AnalyzerRunner;

    constructor(public config: Config) {
        Module.config = config;
        const importResolver = new ImportResolver(config);
        const graph = new Graph();
        const transformer = new Transformer(config, graph, importResolver);
        this.parser = new Parser(graph, transformer, importResolver);
        this.builder = new Builder(config, graph, transformer);
        this.analyzer = new AnalyzerRunner(graph, importResolver);
    }

    async compile() {
        await this.prepareBuild();
        console.log('parsing')
        await this.parser.parseDir(this.config.entryPath + sep + 'commands');
        await this.parser.parseDir(this.config.entryPath + sep + 'managers');
        await this.analyzer.analyze();
        console.log('building')
        await this.builder.build();
    }

    private async prepareBuild() {
        try {
            try {
                const files = await fs.readdir(this.config.buildPath);

                for (const file of files) {
                    const filePath = join(this.config.buildPath, file);
                    const stat = await fs.stat(filePath);

                    if (stat.isDirectory()) {
                        await fs.rm(filePath, { recursive: true });
                    } else {
                        await fs.unlink(filePath);
                    }
                }
            } catch {
                await fs.mkdir(this.config.buildPath, { recursive: true });
            }
        } catch (error: any) {
            console.error(`Error preparing build directory\n`);
            throw error;
        }
    }
}

export default Compiler;