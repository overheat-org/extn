import * as T from '@babel/types';
import { NodePath } from "@babel/traverse";
import { useErrors } from '../utils';

const errors = useErrors({
    EXPECTED_COMPTIME_KNOW_STRING: "The route of decorator should be comptime known string\n\nlike: @api.get('/ping')",


})

function api(path: NodePath<T.Decorator>) {
    const callExpr = path.findParent(p => p.isCallExpression()) as NodePath<T.CallExpression>;
    
    let route: string;
    {
        const routeArgument = callExpr.get('arguments')[0];
        if(!routeArgument.isStringLiteral()) throw errors.EXPECTED_COMPTIME_KNOW_STRING;
        route = routeArgument.node.value;
    }

    const memberExpr = callExpr.get('callee') as NodePath<T.MemberExpression>;
    const method = (memberExpr.node.property as T.Identifier).name;
    
    
}