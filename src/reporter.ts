import { NodePath } from "@babel/traverse";

export type FlameErrorLocation = { path?: string, line?: number, column?: number }

export class FlameError extends Error {
	constructor(message: string, location?: FlameErrorLocation) {
		if (location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
		super(message);
		Error.captureStackTrace?.(this, FlameError);
	}
}

/** @internal */
export function getErrorLocation(path: NodePath, id: string): FlameErrorLocation {
    const loc = path?.node?.loc?.start;
    return { ...(loc ?? {}), path: id };
}