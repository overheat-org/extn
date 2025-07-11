import { ComptimeDecoratorContext } from "../../entities/compilation/decorator-context";

interface CallExprHooks {
	params: unknown[];
	fromDecorator: boolean;
}

interface CallExprHooksFromUnknown extends CallExprHooks {
	fromDecorator: false;
}

interface CallExprHooksFromDecorator extends CallExprHooks {
	params: [object, ComptimeDecoratorContext]
	readonly fromDecorator: true;
}

export type CallExprHooksUnion = CallExprHooksFromDecorator | CallExprHooksFromUnknown;
