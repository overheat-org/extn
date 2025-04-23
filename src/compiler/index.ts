import './polyfills';
import fs from 'fs/promises';
import Config from "../config";
import Graph from "./graph";
import Transformer from "./transformer";
import { join, sep } from 'path';
import { Module } from './module';
import Builder from './builder';
import Parser from './parser';

class Compiler {
    parser: Parser;
    builder: Builder;

    constructor(public config: Config) {
        Module.config = config;
        const graph = new Graph();
        const transformer = new Transformer(config, graph);
        this.parser = new Parser(config, graph, transformer);
        this.builder = new Builder(config, graph, transformer);
    }

    async compile() {
        await this.prepareBuild();
        await this.parser.parseDir(this.config.entryPath + sep + 'commands');
        await this.parser.parseDir(this.config.entryPath + sep + 'managers');
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