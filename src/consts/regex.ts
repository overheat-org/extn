export const CONFIG_PATH = /flame(rc|\.config)/;
export const FLAME_MODULE = /@flame-oh\/manager\-([0-9a-z-]+)/;
export const SUPPORTED_EXTENSIONS = /\.(t|j)sx?$/;
export const HAVE_COMMANDS_DIR = /\/commands\//;
export const IS_COMMAND_FILE = new RegExp("command" + SUPPORTED_EXTENSIONS.source);
export const IS_COMMAND = new RegExp(HAVE_COMMANDS_DIR.source + "|" + IS_COMMAND_FILE.source);
export const DECORATOR_EXPR = /@[a-z][a-zA-Z]+(?=\s)/;
