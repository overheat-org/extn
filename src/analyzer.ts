import { REGEX } from "./consts";
import Graph from "./graph";
import Transformer from "./transformer";

abstract class AnalyzerStep {
    abstract test: RegExp
    abstract analyze(id: string, code: string): void

    constructor(protected transformer: Transformer) {}
}

class DecoratorAnalyzer extends AnalyzerStep {
    test = REGEX.DECORATOR_EXPR;

    analyze(id: string, code: string) {
        
    }
}

class Analyzer {
    private steps = [
        DecoratorAnalyzer
    ].map(a => new a(this.transformer));

    analyze(id: string, code: string) {
        const steps = this.steps.filter(s => s.test.test(code));

        steps
            .map(s => s.analyze(id, code) ?? null)
            .filter(s => !!s);
    }

    constructor(private transformer: Transformer, private graph: Graph) {}
}

export default Analyzer;
