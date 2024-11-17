import * as fs from 'fs';

export default (
    <command name="pong" description="Returns ping">
        {(interaction) => {
            fs.readdirSync('./')
            interaction.reply('Ping!')
        }}
    </command>
)