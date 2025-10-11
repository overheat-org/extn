import Compiler from "./compiler";

(async () => {
	const compiler = new Compiler();
	
	await compiler.build();
})();