import Discord from "discord.js";
import { Access, AccessTarget, UnifiedIdString } from "..";
import Synergy from "../Synergy";
import { StorageUser } from "../Models/StorageUser";

export interface UserEconomyOptions{
    points: number;
    lvl: number;
    xp: number;
}

export interface UserDiscordOptions {
    id: string;
    tag: string;
    avatar?: string;
    banner?: string;
    createdAt: Date;
    user?: Discord.User;
}

export interface UserOptions{
    unifiedId: UnifiedIdString;
    nickname: string;
    groups: string[];
    lang: string;
    discord?: UserDiscordOptions;
    economy: UserEconomyOptions;
}

export default class User implements UserOptions{
    public unifiedId: UnifiedIdString;
    public nickname: string;
    public groups: string[];
    public lang: string;
    public economy: UserEconomyOptions;
    public discord?: UserDiscordOptions;

    constructor(public bot: Synergy, opts: UserOptions){
        this.unifiedId = opts.unifiedId;
        this.nickname = opts.nickname;
        this.groups = opts.groups;
        this.lang = opts.lang;
        this.economy = opts.economy;
        this.discord = opts.discord;
    }

    public async haveAccess(access: AccessTarget[], guild: Discord.Guild){
        return await Access.Check(this, access, guild);
    }

    public bindDiscord(user: Discord.User) {
        this.discord = {
            user,
            id: user.id,
            tag: user.tag,
            avatar: user.avatarURL() ?? undefined,
            banner: user.bannerURL() ?? undefined,
            createdAt: user.createdAt
        }
    }

    public async fetchDiscordUser() {
        if(!this.discord) return;

        this.discord.user = await this.bot.client.users.fetch(this.discord.id);
        this.discord.tag = this.discord.user.tag;
        this.discord.avatar = this.discord.user.avatarURL() ?? undefined;
        this.discord.banner = this.discord.user.bannerURL() ?? undefined;
        return this.discord.user;
    }

    public static fromStorageUser(bot: Synergy, storageUser: StorageUser): User {
        let discordOpts: UserDiscordOptions | undefined;

        if(storageUser.discord) {
            discordOpts = {
                id: storageUser.discord.discordId,
                tag: storageUser.discord.discordTag,
                avatar: storageUser.discord.discordAvatar ?? undefined,
                banner: storageUser.discord.discordBanner ?? undefined,
                createdAt: storageUser.discord.discordCreatedAt,
            };
        }

        let economyOpts: UserEconomyOptions;

        if(storageUser.economy) {
            economyOpts = {
                points: storageUser.economy.economyPoints,
                lvl: storageUser.economy.economyLVL,
                xp: storageUser.economy.economyXP
            }
        } else {
            economyOpts = bot.options.userDefaultEconomy ?? {
                points: 0.0005,
                lvl: 1,
                xp: 0
            }
        }

        return new User(bot, {
            unifiedId: storageUser.unifiedId,
            nickname: storageUser.nickname,
            groups: storageUser.groups,
            lang: storageUser.lang,
            discord: discordOpts,
            economy: economyOpts
        });
    }
}