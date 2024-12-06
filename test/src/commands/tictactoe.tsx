// import { ChatInputCommandInteraction as Interaction } from "discord.js";
import TicTacToe, { GameStatus, Errors } from "../managers/tictactoe";

const games: Record<string, TicTacToe> = {};

export default <command name="tictactoe">
    <subcommand name="play">
        {(interaction) => {
            const channelId = interaction.channelId;
            
            if (games[channelId]) {
                interaction.reply('Já existe um jogo da velha em andamento neste canal.');
                return;
            }

            const game = new TicTacToe();
            games[channelId] = game;

            interaction.reply(`Novo jogo da velha iniciado! Jogador atual: X`);
        }}
    </subcommand>

    <subcommand name="move">
        <string name="coordinate" />
        {(interaction) => {
            const channelId = interaction.channelId;
            const coordinate = interaction.options.getString("coordinate", true);
            
            const game = games[channelId];
            if (!game) {
                interaction.reply('Nenhum jogo da velha em andamento. Use /tictactoe play para iniciar.');
                return;
            }

            const row = parseInt(coordinate[0]) - 1;
            const col = coordinate.charCodeAt(1) - 'a'.charCodeAt(0);

            const result = game.makeMove(row, col);

            if (result === Errors.GameEnded) {
                interaction.reply('O jogo já terminou.');
                return;
            }

            if (result === Errors.InvalidPosition) {
                interaction.reply('Posição inválida.');
                return;
            }

            if (result === Errors.CellOccupied) {
                interaction.reply('Essa célula já está ocupada.');
                return;
            }

            const status = game.getStatus();
            switch (status) {
                case GameStatus.X_Wins:
                    interaction.reply('X venceu o jogo!');
                    delete games[channelId];
                    break;
                case GameStatus.O_Wins:
                    interaction.reply('O venceu o jogo!');
                    delete games[channelId];
                    break;
                case GameStatus.Draw:
                    interaction.reply('Jogo empatado!');
                    delete games[channelId];
                    break;
                default:
                    interaction.reply(`Próximo jogador: ${game.getCurrentPlayer()}`);
            }
        }}
    </subcommand>

    <subcommand name="resign">
        {(interaction) => {
            const channelId = interaction.channelId;
            
            const game = games[channelId];
            if (!game) {
                interaction.reply('Nenhum jogo da velha em andamento.');
                return;
            }

            delete games[channelId];
            interaction.reply('Jogo encerrado por desistência.');
        }}
    </subcommand>
</command>
