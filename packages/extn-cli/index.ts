import Compiler from "@extn/compiler";

(async () => {
	const compiler = new Compiler();
	
	await compiler.build();
})();