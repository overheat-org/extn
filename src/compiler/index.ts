import './polyfills';
import fs from 'fs/promises';
import Config from "../config";
import Graph from "./graph";
import Transformer from "./transformer";
import { join } from 'path';
import { Module } from './module';

class Compiler {
    graph: Graph
    transformer: Transformer;

    constructor(public config: Config) {
        Module.config = config;
        this.graph = new Graph(config),
        this.transformer = new Transformer(this.graph, config)
    }

    async run() {
        await this.prepareBuild();
        await this.transformer.run();
        await this.graph.build();
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