import Analyzer from "./analyzer";
import Graph from "./graph";

abstract class TransformerStep {}

class CommandTransformer extends TransformerStep () {
    testPath = /\$[a-zA-Z\.0-9]+\.(t|j)sx?/
}

class Transformer {
    private analyzer = new Analyzer(this, this.graph);

    transform(id: string, code: string) {
        this.analyzer.analyze(id, code);
    }

    constructor(private graph: Graph) {}
}

export default Transformer;
