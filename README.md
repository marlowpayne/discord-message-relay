# Discord Message Relay

A simple relay for Discord that forwards messages to a destination URL (e.g. N8N webhook).

Meant to be configured with a set of Discord channel IDs to have all their messages fan-in
and relay to a single custom webhook URL to send to.

I use this for my own N8N automation that can be triggered via webhook, and figured I
would publish it in case it can help anyone else.

## Getting Started

### Requirements

- [Docker Compose](https://docs.docker.com/compose/)
- A Discord Bot to act as your message relay
  - Your bot must have the [Message Content Intent](https://docs.discord.com/developers/events/gateway#message-content-intent),
    which is a Privileged Gateway Intent. As long as your bot has less than 10k users, this will
    not require a formal review and you can enable Privileged Intents in the Discord Developer Portal.
- A destination URL you want to send all your Discord messages to (e.g. an N8N webhook)
- Copy `example.env` and rename to `.env`
- Fill in environment variables in `.env` with your values

Running from source with Node and/or local development has an additional requirement:

- [NVM](https://github.com/nvm-sh/nvm) for Node/NPM versioning management

### Environment Variables

- `RELAY_DISCORD_BOT_TOKEN`
  - [Required] Your Discord Bot token so the relay can act on its behalf.
- `RELAY_MESSAGE_DESTINATION_URL`
  - [Required] The URL where all messages from your Discord channels should be sent to.
- `RELAY_DISCORD_CHANNEL_IDS`
  - [Required] An array of strings listing Discord channel IDs that collect messages to be relayed.
- `RELAY_MESSAGE_DESTINATION_USERNAME`
  - [Optional] A username to specify for when your destination URL requires basic HTTP auth.
- `RELAY_MESSAGE_DESTINATION_PASSWORD`
  - [Optional] A password to specify for when your destination URL requires basic HTTP auth.
- `RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS`
  - [Optional, Default value: `false`] When set to `true`, will display usernames and message text in
    console logs to help debugging.

### Run via Docker Compose [Recommended]

1. Copy `example.compose.yaml` and rename to `compose.yaml`
1. Run `docker compose pull` and `docker compose up -d`
1. Follow logs with `docker logs -f discord-message-relay`
1. Test by sending a message in one of your specified Discord channels

### Run from Source with Docker

1. Build and tag: `docker build -t discord-message-relay .`
1. Run while injecting `.env` values: `docker run --rm --env-file .env discord-message-relay`
1. Test by sending a message in one of your specified Discord channels

### Run from Source with Node

1. Run `nvm use`
1. Run `npm run up`
1. Run `npm start`
1. Test by sending a message in one of your specified Discord channels

## Development Builds

Local dev can be via Docker or Nodemon.
In both cases files are not minified and hot reloading is enabled.

### Docker [Recommended]

1. Run `nvm use`
1. Run `npm run devDocker`

### Nodemon

1. Run `nvm use`
1. Run `npm run up`
1. Run `npm run dev`
