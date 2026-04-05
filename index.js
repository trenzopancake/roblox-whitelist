const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const WebSocket = require('ws');
const axios = require('axios');
const { QuickDB } = require("quick.db");
const db = new QuickDB();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const port = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port });

async function getRobloxInfo(userId) {
    try {
        const userRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        return {
            username: userRes.data.name,
            displayName: userRes.data.displayName,
            thumbnail: thumbRes.data.data[0]?.imageUrl || ""
        };
    } catch (e) {
        return null;
    }
}

async function handleWhitelist(userId, member, channel, isInteraction = false) {
    const info = await getRobloxInfo(userId);
    if (!info) {
        const err = "Invalid Roblox User ID.";
        return isInteraction ? { content: err, ephemeral: true } : channel.send(err);
    }

    await db.set(`whitelist_${userId}`, true);

    try {
        const newNickname = `${info.displayName} (@${info.username})`;
        if (member && member.manageable) {
            await member.setNickname(newNickname);
        }
    } catch (e) {
        console.log("Nickname error: " + e.message);
    }

    const embed = new EmbedBuilder()
        .setTitle('✅ Player Whitelisted')
        .setColor(0x00FF00)
        .setThumbnail(info.thumbnail)
        .addFields(
            { name: 'Username', value: info.username, inline: true },
            { name: 'Display Name', value: info.displayName, inline: true },
            { name: 'Roblox ID', value: userId, inline: true }
        )
        .setFooter({ text: `Whitelisted by ${member.user.tag}` })
        .setTimestamp();

    return { embeds: [embed] };
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!whitelist')) return;
    const args = message.content.split(' ');
    const userId = args[1];
    if (!userId) return message.reply("Usage: !whitelist <UserId>");
    const result = await handleWhitelist(userId, message.member, message.channel);
    if (result && result.embeds) message.reply(result);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'whitelist') return;
    const userId = interaction.options.getString('userid');
    const result = await handleWhitelist(userId, interaction.member, interaction.channel, true);
    await interaction.reply(result);
});

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'checkWhitelist') {
                const isWhitelisted = await db.get(`whitelist_${data.userId}`);
                ws.send(JSON.stringify({ success: !!isWhitelisted, userId: data.userId }));
            }
        } catch (e) {}
    });
});

const commands = [
    new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelist a Roblox ID')
        .addStringOption(option => option.setName('userid').setDescription('Roblox User ID').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands('1311699274475765850'), { body: commands });
    } catch (e) {}
})();

client.login(process.env.DISCORD_TOKEN);
