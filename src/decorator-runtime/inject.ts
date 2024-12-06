import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { useErrors } from '../utils';

const errors = useErrors({
    EXPECTED_CLASS: "This decorator only can be used on class declarations",
})

export default {
    name: 'inject',
    comptime(path: NodePath<T.Decorator>, meta: Record<string, unknown>) {
        const classDecl = path.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
        if(!classDecl) throw errors.EXPECTED_CLASS;

        const className = classDecl.get('id').node?.name;
        const program = classDecl.parentPath as NodePath<T.Program | T.ExportDefaultDeclaration>

        if(!program.isExportDefaultDeclaration()) {
            const exportDefault = program.get('body').find(p => p.isExportDefaultDeclaration()) as NodePath<T.ExportDefaultDeclaration> | null;
            const id = exportDefault?.get('declaration').find(p => p.isIdentifier()) as NodePath<T.Identifier> | null;
    
            if(id?.node.name != className) return;
        }

        meta.isInternal = true;
        path.remove();
    }
}