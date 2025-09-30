import Compiler from ".";

(async () => {
	const compiler = new Compiler();
	
	await compiler.build();
})();