import * as t from "vite";
import a from "./plugin.js";
import { ConfigManager as s } from "./config.js";
class r {
  async setup() {
    await this.configManager.setup(), this.config = this.configManager.data, ((this.config.vite ??= {}).plugins ??= []).push(a.setup());
  }
  async build() {
    await this.setup(), await t.build(this.config.vite);
  }
  constructor(i) {
    this.configManager = new s(i);
  }
}
export {
  r as default
};
