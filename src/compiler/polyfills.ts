
import fs from 'fs';
import path from 'path';

import type { Abortable } from 'events';
import type { Stream } from 'stream';
import type { Mode, ObjectEncodingOptions, OpenMode, PathLike } from 'fs';

const originalWriteFile = fs.promises.writeFile;

fs.promises.writeFile = async function (file, data, options) {
    if (options.recursive) {
        const dir = path.dirname(file);
        await fs.promises.mkdir(dir, { recursive: true });
        options = { ...options, recursive: undefined };
    }

    return originalWriteFile(file, data, options);
};

RegExp.merge = (...args) => {
    const source = args.map(r => r.source).join('');
    const flags = [...new Set(args.flatMap(r => r.flags.split('')))].sort().join('');
    return new RegExp(source, flags);
};

declare global {
    interface RegExpConstructor {
        merge(...args: RegExp[]): RegExp
    }
}

declare module "fs/promises" {
    function writeFile(
        file: PathLike | FileHandle,
        data:
            | string
            | NodeJS.ArrayBufferView
            | Iterable<string | NodeJS.ArrayBufferView>
            | AsyncIterable<string | NodeJS.ArrayBufferView>
            | Stream,
        options?:
            | (ObjectEncodingOptions & {
                mode?: Mode | undefined;
                flag?: OpenMode | undefined;
                /**
                 * If all data is successfully written to the file, and `flush`
                 * is `true`, `filehandle.sync()` is used to flush the data.
                 * @default false
                 */
                flush?: boolean | undefined;
                recursive?: boolean | undefined;
            } & Abortable)
            | BufferEncoding
            | null,
    ): Promise<void>;
}