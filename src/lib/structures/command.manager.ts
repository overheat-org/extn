import * as Diseact from 'diseact';
import { Client } from "discord.js";

export class CommandManager {
    listen() {
        this.client.on('interactionCreate', interaction => {
            if(interaction.isChatInputCommand() || interaction.isAutocomplete()) {
                // TODO: make Diseact autocomplete 
                // @ts-ignore
                Diseact.CommandInteractionExecutor(interaction);
            }
        })
    }

    constructor(private client: Client) {}
}