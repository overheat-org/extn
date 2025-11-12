import { NodePath } from "@babel/traverse";

export type ZenErrorLocation = { path?: string, line?: number, column?: number }

export class ZenError extends Error {
	constructor(message: string, location?: ZenErrorLocation) {
		if (location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
		super(message);
		Error.captureStackTrace?.(this, ZenError);
	}
}

/** @internal */
export function getErrorLocation(path: NodePath, id: string): ZenErrorLocation {
    const loc = path?.node?.loc?.start;
    return { ...(loc ?? {}), path: id };
}