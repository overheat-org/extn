import * as fs from 'fs';

export default (
    <command name="ping" description="Returns pong">
        {(interaction) => interaction.reply('Pong!')}
    </command>
)