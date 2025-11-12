export class CommandContainer {
    list = new Array<any>;
    map: Record<string, any> = {};
    private pending = new Set<Promise<any>>();

    get finished(): boolean {
        return this.pending.size === 0;
    }

    add(callback: () => Promise<{ __map__: any }>) {
        const p = callback()
            .then(command => {
                Object.assign(this.map, command.__map__);
                this.list.push(command);

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
