export type FlameErrorLocation = { path: string, line: number, column: number }

export class FlameError extends Error {
	constructor(message: string, location?: FlameErrorLocation) {
		if (location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
		super(message);
		Error.captureStackTrace?.(this, FlameError);
	}
}

export function useErrors<O extends object>(
	obj: O
): { [K in keyof O]: FlameError } {
	const result = {} as any;
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			result[key] = new FlameError(String(obj[key]));
		}
	}
	return result;
}
