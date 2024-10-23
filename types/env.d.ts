namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV: 'development' | 'production'
        TOKEN: string
        TEST_GUILD_ID?: string
        TEST_CHANNEL_ID?: string
        BUILD_PATH: string
    }
}