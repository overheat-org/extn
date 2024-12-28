import { NodePath } from '@babel/traverse';
import * as T from '@babel/types';
import { useErrors } from '../utils';

const errors = useErrors({
    EXPECTED_CLASS: "This decorator only can be used on class declarations",
    SHOULD_BE_GLOBAL: "Injected classes should be in global scope"
})

function inject(path: NodePath<T.Decorator>, meta: Record<string, unknown>) {
    const classDecl = path.findParent(p => p.isClassDeclaration()) as NodePath<T.ClassDeclaration>;
    if(!classDecl) throw errors.EXPECTED_CLASS;

    classDecl.addComment('inner', "@inject entity");

    const className = classDecl.get('id').node!.name;
    let parent = classDecl.parentPath;
    let exported = false;

    switch (true) {
        case parent.isExportNamedDeclaration():
            parent = parent.parentPath;
            exported = true;

        case parent.isProgram():
            const program = parent as NodePath<T.Program>

            if(!exported) {
                if(
                    !program.get('body').some(node => 
                        node.isExportNamedDeclaration() &&
                        node.get('specifiers').some(specifier => 
                            specifier.isExportSpecifier() &&
                            specifier.get('local').node.name === className
                        )
                    )
                ) {
                    classDecl.replaceWith(T.exportNamedDeclaration(classDecl.node));
                };
            }

            break;

        default: throw errors.SHOULD_BE_GLOBAL;
    }

    (meta.injects as Array<string>).push(className!);
    path.remove();
}

export default inject;