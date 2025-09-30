export const FLAME_MODULE = /@flame-oh\/manager\-([0-9a-z-]+)/;
export const SUPPORTED_EXTENSIONS = /\.(t|j)sx?$/;

export const HTTP_METHODS = [
    "get",
    "head",
    "post",
    "put",
    "delete",
    "connect",
    "options",
    "trace",
    "patch"
];

export enum ManifestType {
	Routes,
	DependenciesGraph,
	Events,
	Modules
}