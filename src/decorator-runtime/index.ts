import * as T from '@babel/types';
import { NodePath } from '@babel/traverse';
import inject from "./inject";
import event from './event';

const decoratorsRuntimeMap = { inject, event }

function useComptimeDecorator(path: NodePath<T.Decorator>, meta: Record<string, unknown> = {}) {
    const expr = path.node.expression;
    if(!T.isIdentifier(expr)) return;

    const decoratorRuntime = decoratorsRuntimeMap[expr.name]
    
    if(decoratorRuntime) decoratorRuntime.comptime(path, meta);
    else throw new Error(`Unknown comptime decorator '${expr.name}'`)
}

export default useComptimeDecorator;