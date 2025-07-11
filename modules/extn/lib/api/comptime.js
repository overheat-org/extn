import { Evaluation as i } from "../evaluation/base.js";
import s from "../hooks/compilation.js";
import r from "@babel/generator";
class u extends i {
  constructor() {
    super(...arguments), this.builtinFunctionsMap = {
      comptime: this.analyzeComptimeExpression
    };
  }
  analyze(e) {
    if (!e.includes("comptime")) return;
    const n = this.parse(e), o = new Array();
    n.traverse({
      CallExpression: (t) => o.push(t)
    });
    for (const t of o) this.analyzeCallExpression(t);
  }
  analyzeCallExpression(e) {
    const n = e.get("callee");
    n.isIdentifier() && n.node.name in this.builtinFunctionsMap && this.builtinFunctionsMap[n.node.name](e);
  }
  /**
   * example:
   * ```js
   * comptime(compilation => {});
   * ```
   */
  analyzeComptimeExpression(e) {
    const [n] = e.get("arguments");
    if (!n.isArrowFunctionExpression()) return;
    const o = new s();
    new Function("hooks", `return (${r(n.node).code})(hooks);`)(o);
  }
}
export {
  u as ComptimeExprEvaluation
};
