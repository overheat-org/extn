export function bulkNew<C = new (...args) => any>(...classes: C[]) {
    return (...args) => classes.map(c => new c(...args)) as InstanceType<C>[];
}
