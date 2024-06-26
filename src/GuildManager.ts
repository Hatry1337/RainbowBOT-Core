import Discord from "discord.js";

import { Op, Transaction } from "sequelize";
import { sequelize } from "./Database";

import { GlobalLogger } from "./GlobalLogger";
import Synergy from "./Synergy";
import Guild from "./Structures/Guild";
import { StorageGuild } from "./Models/StorageGuild";
import CachedManager from "./Structures/CachedManager";
import { GuildAlreadyExistError } from "./Structures/Errors";

export default class GuildManager extends CachedManager<Guild> {
    constructor(public bot: Synergy){
        super();
        this.cacheStorage.on("del", this.onCacheEntryDeleted.bind(this));
    }

    public async createFromDiscord(dGuild: Discord.Guild, group: string = "default"){
        let storageGuild = await StorageGuild.findOne({
            where: {
                id: dGuild.id
            }
        });

        if(storageGuild) throw new GuildAlreadyExistError(dGuild);

        storageGuild = await StorageGuild.create({
            id: dGuild.id,
            group,
            name: dGuild.name,
            lang: dGuild.preferredLocale,
            ownerId: dGuild.ownerId,
            icon: dGuild.icon,
            banner: dGuild.banner,
            systemChannelId: dGuild.systemChannelId,
            botJoinedAt: dGuild.joinedAt
        } as StorageGuild);

        let guild = Guild.fromStorageGuild(this.bot, storageGuild);
        guild.guild = dGuild;

        this.cacheStorage.set(guild.id, guild);
        return guild;
    }

    /**
     * Fetches Guild from storage
     * @param id Discord id of guild to fetch
     */
    public async fetchOne(id: string) {
        let storageGuild = await StorageGuild.findOne({
            where: {
                id
            }
        });

        if (!storageGuild) return undefined;

        let guild = Guild.fromStorageGuild(this.bot, storageGuild);
        await guild.fetchDiscordGuild();

        this.cacheStorage.set(id, guild);
        return guild;
    }

    /**
     * Fetches multiple Guilds from storage
     * @param ids Discord ids of Guilds to fetch
     */
    public async fetchBulk(ids: string[]) {
        let res: Map<string, Guild> = new Map();

        let storageGuilds = await StorageGuild.findAll({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });

        for(let storageGuild of storageGuilds) {
            let guild = Guild.fromStorageGuild(this.bot, storageGuild);
            await guild.fetchDiscordGuild();

            this.cacheStorage.set(storageGuild.id, guild);
            res.set(storageGuild.id, guild);
        }
        return res;
    }

    public override async destroy() {
        let t = await sequelize().transaction();

        for(let k of this.cacheStorage.keys()) {
            await this.onCacheEntryDeleted(k, this.cacheStorage.get(k)!, t);
        }

        try {
            await t.commit();
        } catch (e) {
            GlobalLogger.root.error("GuildManager.destroy Error:", e, "\nTransaction:", t);
            await t.rollback();
        }

        await super.destroy();
    }

    private async onCacheEntryDeleted(discordId: string, guild: Guild, transaction?: Transaction) {
        await StorageGuild.update({
            id: guild.id,
            group: guild.group,
            name: guild.name,
            lang: guild.lang,
            ownerId: guild.ownerId,
            icon: guild.icon,
            banner: guild.banner,
            systemChannelId: guild.systemChannelId,
            botJoinedAt: guild.botJoinedAt
        }, {
            where: {
                id: guild.id
            },
            transaction
        }).catch(err => GlobalLogger.root.error("GuildManager.syncCacheEntry Error Updating StorageGuild:", err));
    }
}