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

export enum FileTypes {
	Command,
	Service
} 

export enum ManifestType {
	Routes,
	Dependencies,
	Events,
}