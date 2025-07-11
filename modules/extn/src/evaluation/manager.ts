import { ComptimeExprEvaluation } from '../api/comptime';
import { AssetImportEvaluation } from '../api/import';
import { Evaluation } from './base';

/** @internal */
class Evaluator {
    private evaluations = [
        ComptimeExprEvaluation,
        AssetImportEvaluation
    ] as const;

    private instances: Evaluation[];
    
    evaluate(code: string) {
        this.instances.forEach(e => e.__analyze__(code));
    }

    constructor() {
        this.instances = this.evaluations.map(E => new E);
    }
}

export default Evaluator;
