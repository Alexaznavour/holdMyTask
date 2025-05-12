const { Project, User } = require('../models');
const emoji = require('../utils/emoji');
const keyboard = require('../utils/keyboard');
const sessionService = require('../services/sessionService');

// States for project flow
const PROJECT_STATES = {
  CREATING: 'creating_project',
  WAITING_NAME: 'waiting_project_name',
  WAITING_DESCRIPTION: 'waiting_project_description',
  EDITING: 'editing_project',
  DELETING: 'deleting_project'
};

/**
 * Send projects menu
 */
const showProjectsMenu = async (bot, chatId, userId) => {
  // Clear any existing session state
  sessionService.setState(userId, null);
  
  // Get user's projects
  const user = await User.findOne({ telegramId: userId });
  
  if (!user) {
    return bot.sendMessage(chatId, `${emoji.error} You are not registered. Please use /start to register.`);
  }
  
  // Create keyboard with options
  const buttons = [
    [`${emoji.newProject} Create New Project`],
    [`${emoji.back} Back to Menu`]
  ];
  
  // Add user's projects if they have any
  if (user.projects && user.projects.length > 0) {
    const projects = await Project.find({ _id: { $in: user.projects } });
    
    const projectButtons = projects.map(project => [`${emoji.project} ${project.name}`]);
    buttons.unshift(...projectButtons);
  }
  
  await bot.sendMessage(
    chatId, 
    `${emoji.projects} *Projects*\n\nSelect a project or create a new one:`,
    {
      parse_mode: 'Markdown',
      ...keyboard.createKeyboard(buttons)
    }
  );
};

/**
 * Start project creation flow
 */
const startProjectCreation = async (bot, chatId, userId) => {
  sessionService.setState(userId, PROJECT_STATES.WAITING_NAME);
  
  await bot.sendMessage(
    chatId,
    `${emoji.newProject} *Create New Project*\n\nPlease enter a name for your project:`,
    {
      parse_mode: 'Markdown',
      ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle project name input
 */
const handleProjectNameInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return showProjectsMenu(bot, chatId, userId);
  }
  
  // Store the project name and ask for description
  sessionService.setState(userId, PROJECT_STATES.WAITING_DESCRIPTION);
  sessionService.setData(userId, 'projectName', text);
  
  await bot.sendMessage(
    chatId,
    `${emoji.editProject} Please enter a description for your project (or type "skip" to skip):`,
    {
      parse_mode: 'Markdown',
      ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle project description input
 */
const handleProjectDescriptionInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return showProjectsMenu(bot, chatId, userId);
  }
  
  const session = sessionService.getSession(userId);
  const projectName = session.data.projectName;
  let projectDescription = text;
  
  if (text === 'Skip' || text.toLowerCase() === 'skip') {
    projectDescription = '';
  }
  
  try {
    // Find the user
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      sessionService.clearSession(userId);
      return bot.sendMessage(
        chatId, 
        `${emoji.error} You need to be registered to create a project. Use /start to register.`
      );
    }
    
    // Create the project
    const project = new Project({
      name: projectName,
      description: projectDescription,
      adminId: userId,
    });
    
    await project.save();
    
    // Add the project to the user's projects
    user.projects.push(project._id);
    await user.save();
    
    // Clear the session data
    sessionService.clearSession(userId);
    
    await bot.sendMessage(
      chatId,
      `${emoji.success} Project *${projectName}* created successfully!`,
      { parse_mode: 'Markdown' }
    );
    
    // Show projects menu again
    return showProjectsMenu(bot, chatId, userId);
    
  } catch (error) {
    console.error('Error creating project:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error creating your project. Please try again later.`
    );
    
    sessionService.clearSession(userId);
    return showProjectsMenu(bot, chatId, userId);
  }
};

/**
 * Show project details
 */
const showProjectDetails = async (bot, chatId, userId, projectName) => {
  try {
    // Extract the project name from the button text
    const cleanProjectName = projectName.replace(`${emoji.project} `, '');
    
    // Find the project
    const project = await Project.findOne({ name: cleanProjectName });
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Count team members
    const teamMembers = await User.countDocuments({ projects: project._id });
    
    // Create inline keyboard with options
    const isAdmin = project.adminId === userId;
    const buttons = [];
    
    // Add admin options if the user is the admin
    if (isAdmin) {
      buttons.push([
        { text: `${emoji.editProject} Edit`, callback_data: `edit_project:${project._id}` },
        { text: `${emoji.deleteProject} Delete`, callback_data: `delete_project:${project._id}` }
      ]);
    }
    
    buttons.push([
      { text: `${emoji.team} View Team`, callback_data: `view_team:${project._id}` },
      { text: `${emoji.tasks} View Tasks`, callback_data: `view_tasks:${project._id}` }
    ]);
    
    // Format work days
    const workDays = project.calendar.workDays.join(', ');
    
    const message = `
${emoji.project} *${project.name}*

${project.description ? `${emoji.info} *Description:* ${project.description}\n` : ''}
${emoji.team} *Team Members:* ${teamMembers}
${emoji.calendar} *Work Days:* ${workDays}
${emoji.info} *Created:* ${project.createdAt.toDateString()}
${isAdmin ? `\n⚠️ You are the admin of this project.` : ''}
`;
    
    await bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error showing project details:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error showing project details. Please try again later.`
    );
  }
};

/**
 * Handle callback queries for projects
 */
const handleProjectCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  // Acknowledge the callback query
  await bot.answerCallbackQuery(callbackQuery.id);
  
  if (data.startsWith('edit_project:')) {
    const projectId = data.split(':')[1];
    return startProjectEdit(bot, chatId, userId, projectId);
  }
  
  if (data.startsWith('delete_project:')) {
    const projectId = data.split(':')[1];
    return confirmProjectDeletion(bot, chatId, userId, projectId);
  }
  
  // Other project-related callbacks would be handled here
};

/**
 * Start project editing flow
 */
const startProjectEdit = async (bot, chatId, userId, projectId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== userId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can edit this project.`);
    }
    
    // Set up editing session
    sessionService.setState(userId, PROJECT_STATES.EDITING);
    sessionService.setData(userId, 'projectId', projectId);
    
    // Create inline keyboard for editing options
    const buttons = [
      [
        { text: `${emoji.editProject} Edit Name`, callback_data: `edit_project_name:${projectId}` },
        { text: `${emoji.editProject} Edit Description`, callback_data: `edit_project_desc:${projectId}` }
      ],
      [
        { text: `${emoji.back} Back`, callback_data: `view_project:${projectId}` }
      ]
    ];
    
    await bot.sendMessage(
      chatId,
      `${emoji.editProject} *Edit Project*\n\nWhat would you like to edit?`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error starting project edit:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error starting the edit process. Please try again later.`
    );
  }
};

/**
 * Confirm project deletion
 */
const confirmProjectDeletion = async (bot, chatId, userId, projectId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== userId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can delete this project.`);
    }
    
    // Set up deletion session
    sessionService.setState(userId, PROJECT_STATES.DELETING);
    sessionService.setData(userId, 'projectId', projectId);
    
    // Create inline keyboard for confirmation
    const buttons = [
      [
        { text: `${emoji.select} Yes, delete`, callback_data: `confirm_delete_project:${projectId}` },
        { text: `${emoji.cancel} No, cancel`, callback_data: `cancel_delete_project:${projectId}` }
      ]
    ];
    
    await bot.sendMessage(
      chatId,
      `${emoji.warning} *Delete Project*\n\nAre you sure you want to delete the project "${project.name}"? This action cannot be undone.`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error confirming project deletion:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
  }
};

/**
 * Delete project
 */
const deleteProject = async (bot, chatId, userId, projectId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== userId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can delete this project.`);
    }
    
    const projectName = project.name;
    
    // Remove project from users' projects
    await User.updateMany(
      { projects: projectId },
      { $pull: { projects: projectId } }
    );
    
    // Remove project from users' pending projects
    await User.updateMany(
      { pendingProjects: projectId },
      { $pull: { pendingProjects: projectId } }
    );
    
    // Delete the project
    await Project.findByIdAndDelete(projectId);
    
    // Clear the session data
    sessionService.clearSession(userId);
    
    await bot.sendMessage(
      chatId,
      `${emoji.success} Project "${projectName}" has been deleted successfully.`
    );
    
    // Show projects menu again
    return showProjectsMenu(bot, chatId, userId);
    
  } catch (error) {
    console.error('Error deleting project:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error deleting the project. Please try again later.`
    );
    
    sessionService.clearSession(userId);
    return showProjectsMenu(bot, chatId, userId);
  }
};

module.exports = {
  showProjectsMenu,
  startProjectCreation,
  handleProjectNameInput,
  handleProjectDescriptionInput,
  showProjectDetails,
  handleProjectCallback,
  PROJECT_STATES
}; 