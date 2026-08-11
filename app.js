import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

// env vars
const ENV_CHANNEL_IDS_TO_LISTEN = process.env.RELAY_DISCORD_CHANNEL_IDS;
const channelsToListenTo = new Set(JSON.parse(ENV_CHANNEL_IDS_TO_LISTEN));
const ENV_MESSAGE_DESTINATION_USERNAME =
  process.env.RELAY_MESSAGE_DESTINATION_USERNAME;
const ENV_MESSAGE_DESTINATION_PASSWORD =
  process.env.RELAY_MESSAGE_DESTINATION_PASSWORD;
const ENV_MESSAGE_DESTINATION_URL = process.env.RELAY_MESSAGE_DESTINATION_URL;
const ENV_DISCORD_BOT_TOKEN = process.env.RELAY_DISCORD_BOT_TOKEN;
const ENV_RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS =
  process.env.RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS;
const canDisplayFullLogs = ENV_RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS === "true";

// create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// when the client is ready, run this block only once
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// main message handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === client.user.id) return; // ignore own messages
  if (message.author.bot) return; // ignore other bots' messages

  if (channelsToListenTo.has(message.channel.id)) {
    console.log(`New message on channel: ${message.channel.id}`);
    const msgData = {
      username: message.author.username,
      content: message.content,
      timestamp: new Date(message.createdTimestamp),
    };

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      // add basic http auth if username provided
      if (ENV_MESSAGE_DESTINATION_USERNAME) {
        const base64Buffer = Buffer.from(
          ENV_MESSAGE_DESTINATION_USERNAME +
            ":" +
            ENV_MESSAGE_DESTINATION_PASSWORD,
        ).toString("base64");

        headers.Authorization = `Basic ${base64Buffer}`;
      }

      // ready to send message
      if (canDisplayFullLogs) {
        console.log(
          `Ready to send message "${msgData.content}" from "${msgData.username}" at ${msgData.timestamp}`,
        );
      } else {
        console.log(`Ready to send message at: ${msgData.timestamp}`);
      }

      // send message data to the destination
      const response = await fetch(ENV_MESSAGE_DESTINATION_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(msgData),
      });

      if (response.ok) {
        // success, message received
        if (canDisplayFullLogs) {
          console.log(
            `Message "${msgData.content}" sent successfully to destination "${ENV_MESSAGE_DESTINATION_URL}" from username "${msgData.username}" at ${msgData.timestamp}`,
          );
        } else {
          console.log(
            `Message sent successfully to destination at ${msgData.timestamp}`,
          );
        }
      } else {
        // non-200 response indicating some kind of error
        console.error(
          `Failed to send message to destination: ${response.status} - ${response.statusText}`,
        );
      }
    } catch (err) {
      // caught an error while trying to send message
      if (canDisplayFullLogs) {
        console.error(
          `Error while trying to send message "${msgData.content}" from username "${msgData.username}" at ${msgData.timestamp}: ${err}`,
        );
      } else {
        console.error(
          `Error while trying to send message at ${msgData.timestamp}: ${err}`,
        );
      }
    }
  }
});

// init: log in to Discord with client's token
client.login(ENV_DISCORD_BOT_TOKEN);
