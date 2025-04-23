export class CommandMap {
    values: Record<string, any> = {};
    private pending = new Set<Promise<any>>();

    get finished(): boolean {
        return this.pending.size === 0;
    }

    register(callback: () => Promise<{ __map__: any }>) {
        const p = callback()
            .then(command => {
                Object.assign(this.values, command.__map__);
                return command;
            })
            .catch(err => {
                console.error("Erro ao registrar comando:", err);
                throw err;
            })
            .finally(() => {
                this.pending.delete(p);
            });

        this.pending.add(p);
    }

    async waitForAll(): Promise<void> {
        await Promise.all(this.pending);
    }
}
