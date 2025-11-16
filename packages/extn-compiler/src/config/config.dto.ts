import * as vite from "vite";
import { BitFieldResolvable, GatewayIntentsString } from "discord.js";

export interface Config {
	entryPath: string
	buildPath: string
	commandsPath: string
	servicesPath: string
	cwd: string
	intents: BitFieldResolvable<GatewayIntentsString, number>
	vite: vite.UserConfig
	modules: string[]
}

export interface UserConfig extends Partial<Config> { }

export interface ModuleConfig extends Pick<Config, 
	| 'commandsPath' 
	| 'servicesPath'
	| 'entryPath'
	| 'intents'
> {}

export interface ConfigResolveOptions<Module extends boolean = boolean> { 
	module?: Module
}