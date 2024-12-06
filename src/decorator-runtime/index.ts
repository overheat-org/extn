import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import inject from "./inject";
import event from './event';

const decoratorsRuntimeMap = { inject, event }

function useComptimeDecorator(path: NodePath<T.Decorator>, meta: Record<string, unknown> = {}) {
    const expr = path.node.expression;
    if(!T.isIdentifier(expr)) return;

    decoratorsRuntimeMap[expr.name]?.comptime(path, meta);
}

export default useComptimeDecorator;