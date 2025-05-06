export enum Errors {
    GameEnded,
    InvalidPosition,
    CellOccupied,
    ChannelReservated
}
export enum GameStatus {
    InProgress,
    X_Wins,
    O_Wins,
    Draw
}
export type Player = 'X' | 'O';

class TicTacToe {
    private static games = new Map<string, TicTacToe>();
    private board: string[][];
    private currentPlayer: Player;
    private status: GameStatus;
    constructor(private id: string) {
        this.board = [['', '', ''], ['', '', ''], ['', '', '']];
        this.currentPlayer = 'X';
        this.status = GameStatus.InProgress;
    }
    delete() {
        TicTacToe.games.delete(this.id);
        return true;
    }
    makeMove(row: number, col: number): Errors | boolean {
        // Verifica se o jogo já terminou
        if (this.status !== GameStatus.InProgress) {
            return Errors.GameEnded;
        }

        // Verifica se a posição é válida
        if (row < 0 || row > 2 || col < 0 || col > 2) {
            return Errors.InvalidPosition;
        }

        // Verifica se a célula está vazia
        if (this.board[row][col] !== '') {
            return Errors.CellOccupied;
        }

        // Marca a célula com o jogador atual
        this.board[row][col] = this.currentPlayer;

        // Verifica vitória ou empate
        if (this.checkWinner()) {
            this.status = this.currentPlayer === 'X' ? GameStatus.X_Wins : GameStatus.O_Wins;
            return true;
        }

        // Verifica empate
        if (this.checkDraw()) {
            this.status = GameStatus.Draw;
            return true;
        }

        // Troca o jogador
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        return true;
    }
    private checkWinner(): boolean {
        // Verificar linhas
        for (let i = 0; i < 3; i++) {
            if (this.board[i][0] !== '' && this.board[i][0] === this.board[i][1] && this.board[i][0] === this.board[i][2]) {
                return true;
            }
        }

        // Verificar colunas
        for (let j = 0; j < 3; j++) {
            if (this.board[0][j] !== '' && this.board[0][j] === this.board[1][j] && this.board[0][j] === this.board[2][j]) {
                return true;
            }
        }

        // Verificar diagonais
        if (this.board[0][0] !== '' && this.board[0][0] === this.board[1][1] && this.board[0][0] === this.board[2][2]) {
            return true;
        }
        if (this.board[0][2] !== '' && this.board[0][2] === this.board[1][1] && this.board[0][2] === this.board[2][0]) {
            return true;
        }
        return false;
    }
    private checkDraw(): boolean {
        return this.board.every(row => row.every(cell => cell !== ''));
    }
    resetGame(): void {
        this.board = [['', '', ''], ['', '', ''], ['', '', '']];
        this.currentPlayer = 'X';
        this.status = GameStatus.InProgress;
    }
    getGameState() {
        return {
            board: this.board,
            currentPlayer: this.currentPlayer,
            status: this.status
        };
    }
    getCurrentPlayer(): Player {
        return this.currentPlayer;
    }
    getBoard(): string[][] {
        return this.board.map(row => [...row]);
    }
    getStatus(): GameStatus {
        return this.status;
    }
    static play(channelId: string) {
        if (this.games.has(channelId)) {
            return Errors.ChannelReservated;
        }
        this.games.set(channelId, new this(channelId));
        return true;
    }
    static get(channelId: string): TicTacToe | undefined {
        return this.games.get(channelId);
    }
}
export default TicTacToe;