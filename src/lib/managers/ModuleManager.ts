import { ManifestType } from "../../consts";
import { ClassLike } from "../utils/DependencyInjectorResolver";
import DependencyManager from "./DependencyManager";
import ManifestManager from "./ManifestManager";

export interface Module {
	id: string;
	managers: ClassLike[]
}

class ModuleManager extends ManifestManager {
	async load() {
		const modules = this.manifest[ManifestType.Modules];

		modules.forEach(this.loadModule.bind(this));
	}

	loadModule(module: Module) {
		module.managers.forEach(this.dependencyManager.addDependency);
	}

	constructor(private dependencyManager: DependencyManager) {
		super();
	}
}

export default ModuleManager;