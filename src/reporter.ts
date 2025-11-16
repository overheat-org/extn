import { NodePath } from "@babel/traverse";

export type ExtnErrorLocation = { path?: string, line?: number, column?: number }

export class ExtnError extends Error {
	constructor(message: string, location?: ExtnErrorLocation) {
		if (location) message += `\n    at ${location.path}:${location.line}:${location.column}`;
		super(message);
		Error.captureStackTrace?.(this, ExtnError);
	}
}

/** @internal */
export function getErrorLocation(path: NodePath, id: string): ExtnErrorLocation {
    const loc = path?.node?.loc?.start;
    return { ...(loc ?? {}), path: id };
}