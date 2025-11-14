import { Node } from "@babel/types";

export function ObserveNode(type: Node["type"]) {
	return function (value: any, context: ClassMethodDecoratorContext) {
		context.addInitializer(function (this: any) {
			if('observer' in this) {
				throw new Error("Cannot use @ObserveNode in class without a observer property")
			}
			
			this.observer.on(type, value.bind(this));
		});
	};
}