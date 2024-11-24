export default (
    <command name="pong" description="Returns ping">
        {(interaction) => {
            interaction.reply('Ping!')
        }}
    </command>
)