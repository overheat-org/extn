interface CommandsModule {
    [k: string]: Promise<JSX.Element>
}

export default () => Promise<CommandsModule>