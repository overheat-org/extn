import BuiltinFunction from "../../entities/builtins/function";
import { CallExprHooks } from "../expressions/call";

export abstract class BuiltinFunctionHooks extends BuiltinFunction {
	abstract call(): void;
	
	abstract comptimeCall(hooks: CallExprHooks): void;
}