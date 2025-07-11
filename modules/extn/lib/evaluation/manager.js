import { ComptimeExprEvaluation as s } from "../api/comptime.js";
import { AssetImportEvaluation as o } from "../api/import.js";
class r {
  constructor() {
    this.evaluations = [
      s,
      o
    ], this.instances = this.evaluations.map((a) => new a());
  }
  evaluate(a) {
    this.instances.forEach((t) => t.__analyze__(a));
  }
}
export {
  r as default
};
