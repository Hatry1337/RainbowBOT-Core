import Discord from "discord.js";

import { Colors, Utils } from "../../Utils";
import Module from "../Module";
import User from "../../Structures/User";
import { Synergy } from "../..";
import Access, { AccessTarget } from "../../Structures/Access";

export default class Profile extends Module{
    public Name:        string = "Profile";
    public Description: string = "Using this command you can view your, or someone's profile.";
    public Category:    string = "Info";
    public Author:      string = "Thomasss#9258";

    public Access: AccessTarget[] = [ Access.PLAYER(), Access.BANNED() ]

    private static customProfileFields: Discord.EmbedField[] = [];

    constructor(bot: Synergy, UUID: string) {
        super(bot, UUID);
        this.SlashCommands.push(
            this.bot.interactions.createSlashCommand(this.Name.toLowerCase(), this.Access, this, this.bot.moduleGlobalLoading ? undefined : this.bot.masterGuildId)
            .build(builder => builder
                .setDescription(this.Description)
                .addUserOption(opt => opt
                    .setName("target_user")
                    .setDescription("User who's profile you want to view.")
                    .setRequired(false)
                )
            )
            .onExecute(this.Run.bind(this))
            .commit()
        );
    }

    public static addCustomField(field: Discord.EmbedField) {
        Profile.customProfileFields.push(field);
    }
    
    private createMessageTemplate(user: User){
        let embed = new Discord.EmbedBuilder({
            title: `${user.nickname}'s profile`,
            thumbnail: user.discord?.avatar ? { url: user.discord.avatar } : undefined,
            fields: [
                { name: "Info", value:  `UnifiedId: ${user.unifiedId}\n` +
                                        `Groups: ${user.groups.join(", ")}\n` +
                                        `Language: ${user.lang}` },
                
                { name: "Economy", value:   `Points: ${user.economy.points}\n` +
                                            `LVL: ${user.economy.lvl}\n` +
                                            `XP: ${user.economy.xp}` },
                ],
            color: Colors.Noraml
        });
        if(user.discord) {
            embed.addFields({
                name: "Discord",
                value:`DiscordID: ${user.discord.id}\n` +
                    `Tag: ${user.discord.tag}\n` +
                    `Registered: ${Utils.ts(user.discord.createdAt)}`
            });
        }
        if(Profile.customProfileFields.length !== 0) {
            embed.addFields(Profile.customProfileFields);
        }

        return embed;
    }

    public async Run(interaction: Discord.ChatInputCommandInteraction, user: User) {
        let target_user = interaction.options.getUser("target_user");
        if (!target_user) {
            await interaction.reply({embeds: [this.createMessageTemplate(user)]});
            return;
        }

        if (target_user.bot) {
            await interaction.reply({embeds: [Utils.ErrMsg("You can't view BOT's profile.")]});
            return;
        }

        let userId = this.bot.users.unifiedIdFromDiscordId(target_user.id);
        let target;
        if(userId){
            target = await this.bot.users.get(userId);
        }
        if(!target) {
            target = await this.bot.users.createFromDiscord(target_user);
        }

        await interaction.reply({embeds: [this.createMessageTemplate(target)]});
    }
}