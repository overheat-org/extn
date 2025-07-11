import BuiltinFunction from "../../entities/builtins/function";
import { CallExprHooksUnion } from "../expressions/call";

export abstract class BuiltinFunctionHooks extends BuiltinFunction {
	abstract call(): void;
	
	abstract comptimeCall(hooks: CallExprHooksUnion): void;
}