import Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { GlobalLogger } from "./GlobalLogger";
import RainbowBOT from "./RainbowBOT";
import crypto from "crypto";
import { Routes } from "discord-api-types/rest/v9";
import { User } from ".";

export type ButtonInteractionCallback = (interaction: Discord.ButtonInteraction) => Promise<void>;
export type CommandInteractionCallback = (interaction: Discord.CommandInteraction, user: User) => Promise<void>;

export class InteractiveButton extends Discord.MessageButton {
    private clickCallback?: ButtonInteractionCallback;
    public lastInteraction?: Discord.ButtonInteraction;

    constructor(readonly uuid: string){
        super();
        this.setCustomId(uuid);
    }

    public onClick(callback: ButtonInteractionCallback){
        this.clickCallback = callback;
        return this;
    }

    public async _clicked(interaction: Discord.ButtonInteraction){
        this.lastInteraction = interaction;
        if(this.clickCallback){
            await this.clickCallback(interaction);
        }
    }
}

export class InteractiveCommand extends SlashCommandBuilder{
    public isUpdated: boolean = true;
    public isPushed: boolean = false;
    private execCallback?: CommandInteractionCallback;
    public lastInteraction?: Discord.CommandInteraction;

    constructor(name: string, readonly forGuildId?: string){
        super();
        this.setName(name);
    }

    public onExecute(callback: CommandInteractionCallback){
        this.execCallback = callback;
        return this;
    }

    public async _exec(interaction: Discord.CommandInteraction, user: User){
        this.lastInteraction = interaction;
        if(this.execCallback){
            await this.execCallback(interaction, user);
        }
    }

    public commit(){
        this.isUpdated = false;
        return this;
    }
}

export default class InteractionsManager{
    private interactiveButtonsRegistry: Map<string, InteractiveButton> = new Map;
    private interactiveCommandsRegistry: Map<string, InteractiveCommand> = new Map;
    private updateTimer: NodeJS.Timeout;
    
    constructor(public bot: RainbowBOT) {
        this.updateTimer = setInterval(this.updateSlashCommands.bind(this), 20000);
        this.bot.client.on("interactionCreate", this.onInteractionCreate.bind(this));
        this.bot.events.once("Stop", () => { clearInterval(this.updateTimer); });
    }

    public createCommand(name: string, forGuildId?: string){
        if(this.interactiveCommandsRegistry.has(name)){
            throw new Error("This command already exists.");
        }
        let cmd = new InteractiveCommand(name, forGuildId);
        this.interactiveCommandsRegistry.set(name, cmd);
        return cmd;
    }

    public getCommand(name: string){
        return this.interactiveCommandsRegistry.get(name);
    }

    public createButton(){
        let button = new InteractiveButton(crypto.randomUUID() + "-rbc-ibtn");
        this.interactiveButtonsRegistry.set(button.uuid, button);
        return button;
    }

    public getButton(uuid: string){
        return this.interactiveButtonsRegistry.get(uuid);
    }

    public async updateSlashCommands(){
        let cmds = Array.from(this.interactiveCommandsRegistry.values()).filter(c => !c.isUpdated);
            if(cmds.length === 0) return;

            for(let c of cmds){
                if(c.forGuildId){
                    if(c.isPushed){
                        await this.bot.rest.patch(
                            Routes.applicationGuildCommands(this.bot.client.application!.id, c.forGuildId),
                            { body: c.toJSON() },
                        ).catch(err => GlobalLogger.root.error("Error Updating Guild Slash Command:", err));
                        c.isUpdated = true;
                        return;
                    }else{
                        await this.bot.rest.post(
                            Routes.applicationGuildCommands(this.bot.client.application!.id, c.forGuildId),
                            { body: c.toJSON() },
                        ).catch(err => GlobalLogger.root.error("Error Pushing Guild Slash Command:", err));
                        c.isUpdated = true;
                        c.isPushed = true;
                        return;
                    }
                }else{
                    if(c.isPushed){
                        await this.bot.rest.patch(
                            Routes.applicationCommands(this.bot.client.application!.id),
                            { body: c.toJSON() },
                        ).catch(err => GlobalLogger.root.error("Error Updating Global Slash Command:", err));
                        c.isUpdated = true;
                        return;
                    }else{
                        await this.bot.rest.post(
                            Routes.applicationCommands(this.bot.client.application!.id),
                            { body: c.toJSON() },
                        ).catch(err => GlobalLogger.root.error("Error Pushing Global Slash Command:", err));
                        c.isUpdated = true;
                        c.isPushed = true;
                        return;
                    }
                }
            }
    }

    private async onInteractionCreate(interaction: Discord.Interaction){
        if(interaction.isCommand()){
            let user_id = this.bot.users.idFromDiscordId(interaction.user.id);
            let user: User | null = null;
            if(user_id){
                user = await this.bot.users.fetchOne(user_id);
            }
            if(!user){
                user = await this.bot.users.createFromDiscord(interaction.user);
            }
            let cmd = Array.from(this.interactiveCommandsRegistry.values()).find(c => c.name === interaction.commandName);

            if(!cmd){
                GlobalLogger.root.warn(`Fired "${interaction.commandName}" command but InteractiveCommand not found.`);
                return;
            }
            return await cmd._exec(interaction, user!).catch(err => GlobalLogger.root.error("Command Callback Error:", err));;
        }
        if(interaction.isButton()){
            for(let btn of this.interactiveButtonsRegistry.entries()){
                if(interaction.customId === btn[0]){
                    return await btn[1]._clicked(interaction).catch(err => GlobalLogger.root.error("Button Callback Error:", err));
                }
            }
            return;
        }
    }
}