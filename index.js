const WebSocket = require('ws');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds] });

// IMPORTANTE: Render uses a dynamic port
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

const GUILD_ID = '1490314824297480386';
const ROLE_NAME = 'Whitelist';

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'checkWhitelist') {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(data.userId).catch(() => null);

                if (member && member.roles.cache.some(role => role.name === ROLE_NAME)) {
                    ws.send(JSON.stringify({ success: true, userId: data.userId }));
                } else {
                    ws.send(JSON.stringify({ success: false, userId: data.userId }));
                }
            }
        } catch (e) {
            console.log("Error processing message");
        }
    });
});

client.login(process.env.DISCORD_TOKEN);
console.log(`Server started on port ${port}`);