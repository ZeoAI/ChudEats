# Chud Eats community bot

Chud Eats is a focused Discord bot for a food-deals community. It combines a real verification gate, private support tickets, an interactive deal directory, and persistent giveaways without requiring a hosted database.

## What is included

- **Verification gate**: staff publishes a panel, members receive a short-lived one-time code, and the configured role is granted only after the code is entered. Account-age and avatar checks, attempt limits, expiration, and private logs are built in.
- **Role automation**: verification defaults to role `1535613937167638588`. Either chef role (`1526743183994650755` or `1526743182581170346`) can manage tickets. Closing an order ticket records a purchase, grants buyer role `1553672090182230076` after the first purchase, and grants role `1553669098133651528` at three purchases.
- **Support intake**: members pick a category and complete a short modal with the store, order price, and details. The bot creates a private channel, supports claiming and adding another member, and exports a transcript when closed.
- **Deals board**: the supplied Asian, pizza, snacks, quick-eats, and movie lists are seeded in the bot. Members can browse from an interactive panel or `/deals list`; staff can append local offers with `/deals add`.
- **Giveaways**: giveaways survive restarts, enforce one entry per member, optionally require a role, end automatically, and support staff-only end and reroll commands.
- **Persistent storage**: guild settings, tickets, verification challenges, and giveaways are stored in `data/bot.json`.

## Setup

1. Install Node.js 18.17 or newer.
2. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
3. Enable the **Server Members Intent**. The bot does not need Message Content Intent.
4. Invite it with the `bot` and `applications.commands` scopes. Give it View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Manage Roles, Attach Files, and Manage Messages.
5. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and (during development) `DISCORD_GUILD_ID`. Set `BRAND_BANNER_URL` to a hosted image if you want the main panels to show a custom banner.
6. Install dependencies and start the bot:

   ```text
   npm install
   npm run check
   npm start
   ```

The bot registers commands when it becomes ready. A guild ID makes registration immediate; global registration can take up to an hour to propagate. `npm run deploy` can be used to register commands without starting the gateway.

## First server setup

Run these as a server administrator. Set the server's default role so new members can only see the verification channel, then give the verified role access to the rest of the community:

```text
/verify setup channel:#verify log_channel:#mod-log min_account_age:7 require_avatar:true
/ticket setup panel_channel:#support category:Support transcript_channel:#ticket-logs
/deals panel channel:#deals
```

Members then use the panels. Staff can launch a giveaway from any text channel:

```text
/giveaway start duration:3d prize:"$50 food card" winners:2 required_role:@Verified
```

The giveaway ID appears in its embed and is used with `/giveaway end` or `/giveaway reroll`.

## Permission notes

Setup, giveaway management, and deal editing require Manage Server. Ticket staff actions require the configured staff role or Administrator. The bot role must be above the verification role and staff role, and the bot must be able to manage the configured ticket category.

All user-entered ticket text is clipped before it is placed in embeds. Transcript files are sent only to the configured transcript channel. The JSON file is local state, so back it up with the rest of the bot deployment.
