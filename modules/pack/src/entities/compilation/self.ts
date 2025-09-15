import { PackageJson, TsConfigJson } from "type-fest";
import { Config } from "../../config";

abstract class Compilation {
	readonly env: { [key: string]: string | undefined };
	readonly config: Config;
	readonly package: PackageJson;
	readonly tsconfig: TsConfigJson;
}

export default Compilation;