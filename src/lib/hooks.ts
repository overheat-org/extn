import DependencyBridge from '../runtime/di/bridge';

export * from 'diseact/hooks';

export function useService<S extends new (...args: any[]) => any>(service: S) {
	return DependencyBridge.request(service) as S;
}