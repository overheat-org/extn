import babel from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';

/** @internal */
export abstract class Evaluation {
	__analyze__(code: string) {
		return this.analyze?.(code);
	}

	abstract analyze(code: string): Promise<void> | void;

	protected parse(code: string) {
		const result = babel.parse(code, {
			tokens: true,
		});
		if (!result) throw new Error("Parse failed");

		result.errors?.forEach(console.error);

		let programPath!: NodePath
		
		traverse(result.program, {
			Program: p => void (programPath = p, p.stop())
		});

		return programPath;
	}
}
