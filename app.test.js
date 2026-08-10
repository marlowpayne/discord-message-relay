// mock out the main discord.js dependency and its methods
jest.mock("discord.js", () => {
  const Client = jest.fn(function Client(options) {
    this.options = options;
    this.on = jest.fn();
    this.once = jest.fn();
    this.login = jest.fn();
    this.user = null;
  });

  return {
    Client,
    Events: { ClientReady: "clientReady" },
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2, MessageContent: 4 },
  };
});

// default env vars for tests
const BASE_ENV = {
  RELAY_DISCORD_BOT_TOKEN: "test-token",
  RELAY_MESSAGE_DESTINATION_URL: "https://destination.example",
  RELAY_DISCORD_CHANNEL_IDS: '["channel1","channel2"]',
  RELAY_MESSAGE_DESTINATION_USERNAME: "",
  RELAY_MESSAGE_DESTINATION_PASSWORD: "",
  RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS: "false",
};

const MESSAGE_TIMESTAMP = 1700000000000;

// helper function for test messages
const createMessage = (overrides = {}) => ({
  author: { username: "tester", bot: false },
  content: "Hello, world!",
  channel: { id: "channel1" },
  createdTimestamp: MESSAGE_TIMESTAMP,
  ...overrides,
});

const bootApp = async (envOverrides = {}) => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("RELAY_")) delete process.env[key];
  }
  Object.assign(process.env, BASE_ENV, envOverrides);
  jest.resetModules();
  await import("./app.js");

  const { Client } = jest.requireMock("discord.js");
  return Client.mock.instances[Client.mock.instances.length - 1];
};

const getHandlers = (client) => {
  const messageCreate = client.on.mock.calls.find(
    ([event]) => event === "messageCreate",
  )[1];
  const clientReady = client.once.mock.calls.find(
    ([event]) => event === "clientReady",
  )[1];
  return { messageCreate, clientReady };
};

describe("app.js", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it("creates a Discord client with the expected intents and logs in with the bot token", async () => {
    const client = await bootApp();

    expect(client.options).toEqual({ intents: [1, 2, 4] });
    expect(client.login).toHaveBeenCalledWith("test-token");
  });

  it("logs a ready message once the client is ready", async () => {
    const client = await bootApp();
    const { clientReady } = getHandlers(client);

    clientReady({ user: { tag: "relay-bot#1234" } });

    expect(console.log).toHaveBeenCalledWith(
      "Ready! Logged in as relay-bot#1234",
    );
  });

  it("ignores messages sent by the client itself", async () => {
    const client = await bootApp();
    const author = { username: "tester", bot: false };
    client.user = author;
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage({ author }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ignores messages from other bots", async () => {
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(
      createMessage({ author: { username: "some-bot", bot: true } }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ignores messages from channels not being listened to", async () => {
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage({ channel: { id: "other-channel" } }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("relays a message to the destination with basic auth when credentials are provided", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, statusText: "OK", ok: true });
    const client = await bootApp({
      RELAY_MESSAGE_DESTINATION_USERNAME: "user",
      RELAY_MESSAGE_DESTINATION_PASSWORD: "pass",
    });
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://destination.example");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      username: "tester",
      content: "Hello, world!",
      timestamp: Date(MESSAGE_TIMESTAMP),
    });

    expect(console.log).toHaveBeenCalledWith(
      "New message on channel: channel1",
    );
    expect(console.log).toHaveBeenCalledWith(
      `Ready to send message at: ${Date(MESSAGE_TIMESTAMP)}`,
    );
    expect(console.log).toHaveBeenCalledWith(
      `Message sent successfully to destination at ${Date(MESSAGE_TIMESTAMP)}`,
    );
  });

  it("relays a message without an authorization header when no credentials are provided", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, statusText: "OK", ok: true });
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("treats other 2xx statuses as a successful relay", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 201, statusText: "Created", ok: true });
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(console.log).toHaveBeenCalledWith(
      `Message sent successfully to destination at ${Date(MESSAGE_TIMESTAMP)}`,
    );
  });

  it("logs a failure when the destination responds with a non-200 status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      statusText: "Server Error",
      ok: false,
    });
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(console.error).toHaveBeenCalledWith(
      "Failed to send message to destination: 500 - Server Error",
    );
  });

  it("logs full message details when sensitive data logging is enabled", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, statusText: "OK", ok: true });
    const client = await bootApp({
      RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS: "true",
    });
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(console.log).toHaveBeenCalledWith(
      `Ready to send message "Hello, world!" from "tester" at ${Date(MESSAGE_TIMESTAMP)}`,
    );
    expect(console.log).toHaveBeenCalledWith(
      `Message "Hello, world!" sent successfully to destination "https://destination.example" from username "tester" at ${Date(MESSAGE_TIMESTAMP)}`,
    );
  });

  it("logs a detailed error when the fetch fails and sensitive data logging is enabled", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const client = await bootApp({
      RELAY_DISPLAY_SENSITIVE_DATA_IN_LOGS: "true",
    });
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(console.error).toHaveBeenCalledWith(
      `Error while trying to send message "Hello, world!" from username "tester" at ${Date(MESSAGE_TIMESTAMP)}: Error: network down`,
    );
  });

  it("logs a minimal error when the fetch fails and sensitive data logging is disabled", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const client = await bootApp();
    const { messageCreate } = getHandlers(client);

    await messageCreate(createMessage());

    expect(console.error).toHaveBeenCalledWith(
      `Error while trying to send message at ${Date(MESSAGE_TIMESTAMP)}: Error: network down`,
    );
  });
});
