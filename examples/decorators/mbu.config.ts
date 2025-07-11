import { BuiltinFunctionHooks } from "..";

const log = {
	name: "log",
	description: "creates a proxy and log it",
	comptimeCall(hooks) {
		if (!hooks.fromDecorator || hooks.params[1].kind != 'class') return;

		const [target, ctx] = hooks.params;
		
		target.parent.insertAfter(`
			${target.name} = new Proxy(${target.name}, {
				construct(Target, args, newTarget) {
					const instance = Reflect.construct(Target, args, newTarget);
					return new Proxy(instance, {
						get(target, prop, receiver) {
							console.log(\`GET \${String(prop)}\`);
							const value = Reflect.get(target, prop, receiver);
							if (typeof value === "function") {
								return function (...args: any[]) {
									console.log(\`CALL \${String(prop)} with\`, args);
									return value.apply(this, args);
								};
							}
							return value;
						},
						set(target, prop, value, receiver) {
							console.log(\`SET \${String(prop)} to\`, value);
							return Reflect.set(target, prop, value, receiver);
						}
					});
				}
			});
		`);
	},
} as BuiltinFunctionHooks;

export default {
	env: {
		builtins: [
			log
		]
	}
}