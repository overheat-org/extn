import Compilation from "../entities/compilation/self";

class CompilationHooks extends Compilation {
	setStaticCache() {}
	
	getStaticCache() {}

	generateComputedData(name: string, generator: () => unknown): unknown {}

	onDataChange(callback: (key: string, value: unknown) => void): void {}
}

export default CompilationHooks;