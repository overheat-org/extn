import * as a from "fs";
import { join as e } from "path";
class o {
  eval(t) {
    this.evalEnv(t.env);
  }
  // TODO: push default config
  evalEnv(t) {
    var i;
    (i = t == null ? void 0 : t.builtins) == null || i.forEach(this.evalBuiltin.bind(this));
  }
  evalBuiltin(t) {
  }
}
class c {
  constructor(t) {
    this.configData = t, this.cwd = process.cwd(), this.configEvaluator = new o(), this.configRegex = /^\.extnrc|extn\.config\.(j|t)s(on)?$/;
  }
  async setup() {
    const t = await this.getConfigPath();
    let i = this.configData ?? t ? await a.promises.readFile(t, "utf-8") : void 0;
    const s = i ? await this.parseConfigData(i, t) : {};
    this.data = s, this.configEvaluator.eval(s);
  }
  async getConfigPath() {
    const i = (await a.promises.readdir(this.cwd)).find((s) => this.configRegex.test(s));
    if (i)
      return e(this.cwd, i);
  }
  async parseConfigData(t, i) {
    if (/\.(j|t)s$/.test(i))
      return await import(i);
    if (/\.json|\.\w+rc$/.test(i))
      return JSON.parse(t);
    throw new Error("Config extension not recognized");
  }
}
export {
  c as ConfigManager
};
