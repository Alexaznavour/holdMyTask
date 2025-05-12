require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const moment = require('moment');

// Import controllers and services
const { projectController, userController, taskController } = require('./src/controllers');
const { sessionService, NotificationService } = require('./src/services');
const connectDB = require('./src/utils/db');
const emoji = require('./src/utils/emoji');
const keyboard = require('./src/utils/keyboard');

// Check if bot token is provided
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is not defined in .env file');
  process.exit(1);
}

// Check if MongoDB URI is provided
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Connect to MongoDB
connectDB();

// Initialize the notification service
const notificationService = new NotificationService(bot);
notificationService.start();

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  
  await bot.sendMessage(
    chatId,
    `${emoji.info} *Welcome to Task Manager Bot!*\n\nThis bot helps you manage projects and tasks with your team.`,
    {
      parse_mode: 'Markdown',
      ...keyboard.mainMenuKeyboard
    }
  );
  
  // Start user registration if not registered
  await userController.registerUser(bot, chatId, userId, username);
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(
    chatId,
    `${emoji.help} *Task Manager Bot Help*\n\n` +
    `Here are the available commands:\n\n` +
    `/start - Start the bot and register\n` +
    `/help - Show this help message\n` +
    `/projects - Manage your projects\n` +
    `/tasks - Manage your tasks\n` +
    `/team - View your team\n` +
    `/today - Show tasks for today\n` +
    `/profile - View your profile\n` +
    `/join - Join a project`,
    {
      parse_mode: 'Markdown'
    }
  );
});

bot.onText(/\/projects/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  await projectController.showProjectsMenu(bot, chatId, userId);
});

bot.onText(/\/tasks/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  await taskController.showTasksMenu(bot, chatId, userId);
});

bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  await taskController.showTodayTasks(bot, chatId, userId);
});

bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  await userController.showUserProfile(bot, chatId, userId);
});

bot.onText(/\/join/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  await userController.startJoinProject(bot, chatId, userId);
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  
  if (data.startsWith('edit_project:') || 
      data.startsWith('delete_project:') ||
      data.startsWith('view_project:') ||
      data.startsWith('back_to_project:') ||
      data.startsWith('confirm_delete_project:') ||
      data.startsWith('cancel_delete_project:') ||
      data.startsWith('edit_project_name:') ||
      data.startsWith('edit_project_desc:')) {
    await projectController.handleProjectCallback(bot, callbackQuery);
    return;
  }
  
  if (data.startsWith('view_team:') ||
      data.startsWith('approve_join:') ||
      data.startsWith('reject_join:') ||
      data.startsWith('add_member:') ||
      data.startsWith('add_member_confirm:') ||
      data === 'edit_profile' ||
      data === 'back_to_menu') {
    await userController.handleUserCallback(bot, callbackQuery);
    return;
  }
  
  if (data.startsWith('create_task:') ||
      data === 'cancel_task_creation' ||
      data.startsWith('task_status:') ||
      data.startsWith('edit_task:') ||
      data.startsWith('delete_task:') ||
      data === 'back_to_tasks') {
    await taskController.handleTaskCallback(bot, callbackQuery);
    return;
  }
  
  // Default case - unknown callback query
  await bot.answerCallbackQuery(callbackQuery.id, {
    text: 'This button is not implemented yet.',
    show_alert: true
  });
});

// Message handler for user inputs
bot.on('message', async (msg) => {
  // Ignore commands
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const username = msg.from.username;
  
  if (!text) return;
  
  // Check the current session state
  const session = sessionService.getSession(userId);
  
  // Handle session state changes
  if (session.state === userController.USER_STATES.WAITING_NAME) {
    await userController.handleNameInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === userController.USER_STATES.WAITING_SURNAME) {
    await userController.handleSurnameInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === userController.USER_STATES.WAITING_ROLE) {
    await userController.handleRoleInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === userController.USER_STATES.WAITING_CONTACT) {
    await userController.handleContactInput(bot, chatId, userId, text, username);
    return;
  }
  
  if (session.state === userController.USER_STATES.WAITING_JOIN_PROJECT) {
    await userController.handleJoinProjectInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === projectController.PROJECT_STATES.WAITING_NAME) {
    await projectController.handleProjectNameInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === projectController.PROJECT_STATES.WAITING_DESCRIPTION) {
    await projectController.handleProjectDescriptionInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === taskController.TASK_STATES.WAITING_NAME) {
    await taskController.handleTaskNameInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === taskController.TASK_STATES.WAITING_DESCRIPTION) {
    await taskController.handleTaskDescriptionInput(bot, chatId, userId, text);
    return;
  }
  
  if (session.state === taskController.TASK_STATES.WAITING_DUE_DATE) {
    await taskController.handleTaskDueDateInput(bot, chatId, userId, text);
    return;
  }
  
  // Handle main menu button clicks
  if (text === `${emoji.projects} Projects`) {
    await projectController.showProjectsMenu(bot, chatId, userId);
    return;
  }
  
  if (text === `${emoji.tasks} Tasks`) {
    await taskController.showTasksMenu(bot, chatId, userId);
    return;
  }
  
  if (text === `${emoji.task} My Tasks`) {
    await taskController.showMyTasks(bot, chatId, userId);
    return;
  }
  
  if (text === `${emoji.task} Create New Task`) {
    await taskController.startTaskCreation(bot, chatId, userId);
    return;
  }
  
  if (text === `${emoji.newProject} Create New Project`) {
    await projectController.startProjectCreation(bot, chatId, userId);
    return;
  }
  
  if (text.startsWith(`${emoji.project} `)) {
    await projectController.showProjectDetails(bot, chatId, userId, text);
    return;
  }
  
  if (text === `${emoji.back} Back to Menu`) {
    sessionService.clearSession(userId);
    await bot.sendMessage(
      chatId,
      `${emoji.menu} *Main Menu*`,
      {
        parse_mode: 'Markdown',
        ...keyboard.mainMenuKeyboard
      }
    );
    return;
  }
  
  // Default message if no state or recognized command
  await bot.sendMessage(
    chatId,
    `${emoji.error} I don't understand that command. Please use the menu options or type /help to see available commands.`
  );
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Bot started. Press Ctrl-C to exit.'); 