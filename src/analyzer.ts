import { REGEX } from "./consts";
import Graph from "./graph";
import Transformer from "./transformer";

class Analyzer {
    analyze(id: string, code: string) {
        const steps = this.steps.filter(s => s.test.test(code));

        steps
            .map(s => s.analyze(id, code) ?? null)
            .filter(s => !!s);
    }

    constructor(private transformer: Transformer['steps'], private graph: Graph) {
        this.steps = 
    }
}

export default Analyzer;
