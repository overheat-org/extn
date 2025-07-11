import { name as r, version as a } from "./package.json.js";
import s from "./evaluation/manager.js";
class m {
  constructor() {
    this.name = r, this.version = a, this.evaluator = new s();
  }
  transform(t, o) {
    this.evaluator.evaluate(t);
  }
  static setup() {
    const t = new this();
    return {
      name: r,
      version: a,
      transform: t.transform
    };
  }
}
export {
  m as default
};
