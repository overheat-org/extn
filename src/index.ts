export { default as Compiler } from './compiler';
export { default as BuiltinFunction } from './entities/builtins/function';
export * from './entities/compilation/decorator-context';
export * from './hooks/declarations/function';
export * from './hooks/expressions/call';
export { 
	Environment, 
	Builtin, 
	Config
} from './config';