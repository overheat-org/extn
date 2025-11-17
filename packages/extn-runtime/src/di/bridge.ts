type Callback = (...args: any[]) => unknown;

let cb!: undefined | Callback;

export const DependencyBridge = {
	connect(callback: Callback) {
		cb = callback;
	},

	request<E>(entity: E) {
		if(!cb) {
			throw new Error("DependencyBridge aren't connected");
		}
		
		return cb(entity) as E;
	}
}