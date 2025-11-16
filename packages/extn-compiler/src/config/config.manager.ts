import fs from 'node:fs/promises';
import { ConfigEvaluator } from "./config.evaluator";
import { fileURLToPath, pathToFileURL } from 'url';
import { join as j } from "node:path";
import { UserConfig } from './config.dto';

/**
 * Get config file based in cwd path and evaluate
 */
export class ConfigManager {
	private configEvaluator = new ConfigEvaluator();

	regex = /^\.extnrc|extn\.config\.(j|t)s(on)?$/;

	async resolveModule(cwd: string) {
		const path = await this.findFile(cwd);
		const data = path ? await fs.readFile(path, 'utf-8') : '{}';
		const unresolved = await this.parseData(path ?? '.extnrc', data);
		return this.configEvaluator.evalModule(unresolved);
	}

	async resolve(cwd: string) {
		const path = await this.findFile(cwd);
		const data = path ? await fs.readFile(path, 'utf-8') : '{}';
		const unresolved = await this.parseData(path ?? '.extnrc', data);
		return this.configEvaluator.eval(unresolved);
	}

	// FIXME: Provavelmente o findFile está recebendo um file:// 
	// em vez de um arquivo absoluto comum. No ESM o fs não espera
	// um protocolo file, em vez disso use apenas paths comuns
	async findFile(cwd: string) {
		if(cwd.startsWith('file:')) {
			cwd = fileURLToPath(cwd);
		}
		
		const files = await fs.readdir(cwd);
		const fileName = files.find(f => this.regex.test(f));
		if (!fileName) return;

		return j(cwd, fileName);
	}

	parseData(path: string, data: string) {
		if (/\.(j|t)s$/.test(path)) {
			return (async () => (
				{...(await import(pathToFileURL(path).href)).default}
			))() as Promise<UserConfig>;
		}
		else if (/\.json|\.\w+rc$/.test(path)) {
			return JSON.parse(data) as UserConfig;
		}

		throw new Error("Config extension not recognized");
	}
}