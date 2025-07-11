export type ComptimeDecoratorContext =
	| ComptimeClassDecoratorContext;

export interface ComptimeClassDecoratorContext {
	readonly kind: "class";
}