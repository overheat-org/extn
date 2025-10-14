@injectable
export class Payment {
    a: number
    constructor() {
        this.a = 5;
        console.log('Payment manager initialized');
    }
}