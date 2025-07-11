import { Evaluation } from "../evaluation/base";

declare global {
	interface ImportMeta {
		asset(path: string): void
	}
}

/** @internal */
export class AssetImportEvaluation extends Evaluation {
    analyze(code: string): Promise<void> | void {
        
    }
}

