import { Endpoint } from './protocols';
import { Event } from './event';

export enum ManifestType {
	Routes,
	Dependencies,
	Events,
}

class Manifest {
	constructor(
		public routes: Endpoint[],
		public dependencies: any,
		public events: Event[],
	) {}
	
	static async parse(path: string) {
		const data = await import(path);

		return new this(
			data[ManifestType.Routes],
			data[ManifestType.Dependencies],
			data[ManifestType.Events]
		);
	}
}

export default Manifest;