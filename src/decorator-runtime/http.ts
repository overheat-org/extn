import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";

function http(path: NodePath<T.Decorator>) {
    path.remove();
}

export default http;