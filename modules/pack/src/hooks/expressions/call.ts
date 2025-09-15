import { ComptimeDecoratorContext } from "../../entities/compilation/decorator-context";
import { DecoratorExprHooks } from "./decorator";

interface BaseCallExprHooks {
	readonly params: unknown[];
	readonly from: unknown;
}

interface CallExprHooksFromDecorator extends BaseCallExprHooks {
	readonly params: [object, ComptimeDecoratorContext]
	readonly from: DecoratorExprHooks;
}

export type CallExprHooks = 
	| BaseCallExprHooks
	| CallExprHooksFromDecorator;
