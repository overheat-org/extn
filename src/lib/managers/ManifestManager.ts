import path from "path";
import { Endpoint } from "./CommunicationManager";
import { Event } from "./EventManager";
import { ManifestType } from "../../consts";
import { Module } from "./ModuleManager";

class ManifestManager {
	private static manifest: {
		[ManifestType.Routes]: Endpoint[]
		[ManifestType.DependenciesGraph]: any
		[ManifestType.Events]: Event[]
		[ManifestType.Modules]: Module[]
	};
	protected manifest = ManifestManager.manifest;

	static async loadFile(entryPath: string) {
		this.manifest = await import(path.join(entryPath, "manifest.js"));
	}
	
	constructor() {}
}

export default ManifestManager;