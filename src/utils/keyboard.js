const emoji = require('./emoji');

/**
 * Create a keyboard markup for Telegram messages
 * @param {Array} buttons - Array of button arrays
 * @param {Object} options - Additional options
 * @returns {Object} Keyboard markup object
 */
const createKeyboard = (buttons, options = {}) => {
  return {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: options.resize !== false,
      one_time_keyboard: options.oneTime === true
    }
  };
};

/**
 * Create an inline keyboard markup for Telegram messages
 * @param {Array} buttons - Array of button arrays (each containing objects with text and callback_data)
 * @returns {Object} Inline keyboard markup object
 */
const createInlineKeyboard = (buttons) => {
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
};

// Common keyboards
const mainMenuKeyboard = createKeyboard([
  [`${emoji.projects} Projects`, `${emoji.tasks} Tasks`],
  [`${emoji.team} Team`, `${emoji.settings} Settings`]
]);

const backButton = createKeyboard([
  [`${emoji.back} Back to Menu`]
]);

const confirmKeyboard = createKeyboard([
  [`${emoji.select} Confirm`, `${emoji.cancel} Cancel`]
]);

const taskStatusKeyboard = createKeyboard([
  [`${emoji.todo} To Do`, `${emoji.inProgress} In Progress`],
  [`${emoji.done} Done`, `${emoji.back} Back`]
]);

module.exports = {
  createKeyboard,
  createInlineKeyboard,
  mainMenuKeyboard,
  backButton,
  confirmKeyboard,
  taskStatusKeyboard
}; 