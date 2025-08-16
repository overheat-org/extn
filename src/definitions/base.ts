import Transformer from "../transformer";

export enum Target {
    Class,
    Method,
    Param,
}

type DecoratorErrors = Partial<Record<
    | "EXAMPLE"
    , string>>

export class Decorator<T extends Target[] = any> {
    name!: string
    targets!: T
    decorators?: Decorator[]
    errors?: DecoratorErrors
    transform!: (this: Transformer, decoratorData: DecoratorAst<T>) => void

    static create<T extends Target[]>(object: Decorator<T>) {
        return object;
    }

    static errors = {
        WRONG_SYNTAX: (a, b, c) => new FlameError(`Wrong syntax for decorator: ${a}\n\n${b}`, c),
    } as const;

    private constructor() { };
}

type TargetMap = {
    [Target.Class]: T.ClassDeclaration
    [Target.Method]: T.ClassMethod
    [Target.Param]: T.Identifier
}

export interface DecoratorAst<T extends Target[] = Target[]> {
    target: NodePath<TargetMap[T[number]]>
    params: Array<NodePath<T.MemberExpression['property']>>
    path: string
    node: NodePath<T.Decorator>
}

type ContainerErrors = Partial<Record<
    | "UNKNOWN_DECORATOR"
    | "USING_AS_DECORATOR"
    , string>>;

export class Container {
    name!: string
    decorators!: Decorator[]
    errors?: ContainerErrors

    static create(object: Container) {
        return object;
    }

    private constructor() { }
}
