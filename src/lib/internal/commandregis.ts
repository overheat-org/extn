export class CommandMap {
    values = {}
    private pending = new Array<Promise<any>>();
   
    get finished(): boolean {
        return this.pending.length === 0;
    }
    
    register(callback: () => Promise<{ __map__: any }>) {
        const cb = callback();
       
        this.pending.push(cb);
        
        const promiseIndex = this.pending.length - 1;
        cb.then(command => {
            Object.assign(this.values, command.__map__);
            
            this.pending.splice(promiseIndex, 1);
            
            return command;
        }).catch(error => {
            console.error("Erro ao registrar comando:", error);
            
            this.pending.splice(promiseIndex, 1);
            
            throw error;
        });
    }
    
    async waitForAll(): Promise<void> {
        await Promise.all(this.pending);
    }
}