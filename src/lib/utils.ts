import _Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';

export class Storage<V = any> extends _Keyv<V> {
    constructor(namespace: string) {
        super(new KeyvSqlite(`sqlite://${process.cwd()}/database/data.sqlite`), { namespace });
    }
}

const INCREMENT_NAMESPACE = "_INCREMENT_";
let _incremental: Storage<number>;

export const autoincrement = async (type: string) => {
    const curr = ((await (_incremental ??= new Storage<number>(INCREMENT_NAMESPACE)).get(type)) ?? 0) + 1;
    await _incremental.set(type, curr);

    return { num: curr, str: curr.toString() }
};