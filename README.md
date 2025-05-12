# Telegram Task Manager Bot

A Telegram bot for managing projects, team members, and tasks. Ideal for small teams who want to collaborate and keep track of their work.

## Features

- **Project Management**: Create, edit, and delete projects
- **Team Management**: Add team members to projects, manage roles and permissions
- **Task Management**: Create tasks with due dates, priorities, and assignments
- **Task Lifecycle**: Track tasks from todo to in-progress to done
- **Notifications**: Get reminded of upcoming and overdue tasks
- **Team Collaboration**: See what team members are working on

## Requirements

- Node.js (v12 or later)
- MongoDB
- Telegram Bot API key (from BotFather)

## Setup with BotFather

1. Open Telegram and search for @BotFather
2. Start a chat with BotFather and send `/newbot`
3. Follow the instructions to create a new bot
4. Once your bot is created, BotFather will give you a token. This is your `BOT_TOKEN`
5. Set up commands for your bot by sending `/setcommands` to BotFather
6. Choose your bot and send the following commands list:

```
start - Start the bot and register
help - Show help message
projects - Manage your projects
tasks - Manage your tasks
team - View your team
today - Show tasks for today
profile - View your profile
join - Join a project
```

## Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/telegram-task-manager-bot.git
cd telegram-task-manager-bot
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file in the root directory with the following content:
```
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=mongodb://localhost:27017/task-manager-bot
NODE_ENV=development
```

Replace `your_telegram_bot_token` with the token you received from BotFather.

4. Make sure MongoDB is running on your system.

## Running the Bot

Start the bot with:

```
npm start
```

For development with auto-restart:

```
npm run dev
```

## Bot Commands

- `/start` - Start the bot and register
- `/help` - Show help message
- `/projects` - Manage your projects
- `/tasks` - Manage your tasks
- `/team` - View your team
- `/today` - Show tasks for today
- `/profile` - View your profile
- `/join` - Join a project

## Deployment

For production deployment, update the `.env` file with your production MongoDB URI and set `NODE_ENV=production`.

### Hosting on a VPS

1. Connect to your VPS via SSH
2. Clone the repository and install dependencies
3. Set up a process manager like PM2:
```
npm install -g pm2
pm2 start app.js --name "task-manager-bot"
pm2 save
pm2 startup
```

## License

MIT
