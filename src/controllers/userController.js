const { User, Project } = require('../models');
const emoji = require('../utils/emoji');
const keyboard = require('../utils/keyboard');
const sessionService = require('../services/sessionService');

// States for user flow
const USER_STATES = {
  REGISTERING: 'registering_user',
  WAITING_NAME: 'waiting_user_name',
  WAITING_SURNAME: 'waiting_user_surname',
  WAITING_ROLE: 'waiting_user_role',
  WAITING_CONTACT: 'waiting_user_contact',
  WAITING_JOIN_PROJECT: 'waiting_join_project',
  EDITING: 'editing_user'
};

/**
 * Register a new user
 */
const registerUser = async (bot, chatId, userId, username) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ telegramId: userId });
    
    if (existingUser) {
      return bot.sendMessage(
        chatId,
        `${emoji.info} You are already registered as *${existingUser.name}* ${existingUser.surname ? existingUser.surname : ''}.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Start registration flow
    sessionService.setState(userId, USER_STATES.WAITING_NAME);
    
    await bot.sendMessage(
      chatId,
      `${emoji.user} *Registration*\n\nPlease enter your first name:`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
      }
    );
    
  } catch (error) {
    console.error('Error registering user:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error during registration. Please try again later.`
    );
  }
};

/**
 * Handle user name input during registration
 */
const handleNameInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return bot.sendMessage(
      chatId,
      `${emoji.cancel} Registration cancelled.`,
      { ...keyboard.mainMenuKeyboard }
    );
  }
  
  // Store name and ask for surname
  sessionService.setState(userId, USER_STATES.WAITING_SURNAME);
  sessionService.setData(userId, 'name', text);
  
  await bot.sendMessage(
    chatId,
    `${emoji.user} Great! Now please enter your surname (or "skip" to skip):`,
    {
      ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle user surname input during registration
 */
const handleSurnameInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return bot.sendMessage(
      chatId,
      `${emoji.cancel} Registration cancelled.`,
      { ...keyboard.mainMenuKeyboard }
    );
  }
  
  let surname = text;
  if (text === 'Skip') {
    surname = '';
  }
  
  // Store surname and ask for role
  sessionService.setState(userId, USER_STATES.WAITING_ROLE);
  sessionService.setData(userId, 'surname', surname);
  
  await bot.sendMessage(
    chatId,
    `${emoji.user} Thanks! What is your role? (e.g., Developer, Designer, etc.):`,
    {
      ...keyboard.createKeyboard([
        ['Developer', 'Designer'],
        ['Manager', 'Tester', 'Other'],
        [`Skip`, `${emoji.cancel} Cancel`]
      ])
    }
  );
};

/**
 * Handle user role input during registration
 */
const handleRoleInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return bot.sendMessage(
      chatId,
      `${emoji.cancel} Registration cancelled.`,
      { ...keyboard.mainMenuKeyboard }
    );
  }
  
  let role = text;
  if (text === 'Skip') {
    role = '';
  }
  
  // Store role and ask for contact
  sessionService.setState(userId, USER_STATES.WAITING_CONTACT);
  sessionService.setData(userId, 'role', role);
  
  await bot.sendMessage(
    chatId,
    `${emoji.user} Almost done! Please provide your contact information (email, phone, or Telegram username):`,
    {
      ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle user contact input during registration
 */
const handleContactInput = async (bot, chatId, userId, text, username) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return bot.sendMessage(
      chatId,
      `${emoji.cancel} Registration cancelled.`,
      { ...keyboard.mainMenuKeyboard }
    );
  }
  
  // Get data from session
  const session = sessionService.getSession(userId);
  const name = session.data.name;
  const surname = session.data.surname;
  const role = session.data.role;
  
  let contact = text;
  if (text === 'Skip') {
    contact = username || '';
  }
  
  try {
    // Create the user
    const user = new User({
      telegramId: userId,
      name,
      surname,
      role,
      contact
    });
    
    await user.save();
    
    // Clear the session data
    sessionService.clearSession(userId);
    
    await bot.sendMessage(
      chatId,
      `${emoji.success} *Registration Successful!*\n\nWelcome, ${name}! You can now use the task management features.`,
      {
        parse_mode: 'Markdown',
        ...keyboard.mainMenuKeyboard
      }
    );
    
  } catch (error) {
    console.error('Error completing registration:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error during registration. Please try again later.`
    );
    
    sessionService.clearSession(userId);
  }
};

/**
 * Show user profile
 */
const showUserProfile = async (bot, chatId, userId) => {
  try {
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return bot.sendMessage(
        chatId,
        `${emoji.error} You are not registered. Please use /start to register.`
      );
    }
    
    const projects = await Project.find({ _id: { $in: user.projects } });
    
    let projectsText = '';
    if (projects.length > 0) {
      projectsText = '\n\n*Projects:*\n' + projects.map(project => `- ${project.name}`).join('\n');
    }
    
    const message = `
${emoji.user} *Your Profile*

*Name:* ${user.name} ${user.surname}
${user.role ? `*Role:* ${user.role}\n` : ''}
${user.contact ? `*Contact:* ${user.contact}\n` : ''}
*Joined:* ${user.createdAt.toDateString()}
${projectsText}
`;
    
    const buttons = [
      [{ text: `${emoji.editUser} Edit Profile`, callback_data: 'edit_profile' }],
      [{ text: `${emoji.back} Back to Menu`, callback_data: 'back_to_menu' }]
    ];
    
    await bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error showing user profile:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error loading your profile. Please try again later.`
    );
  }
};

/**
 * Show team for a project
 */
const showProjectTeam = async (bot, chatId, userId, projectId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Find team members
    const teamMembers = await User.find({ projects: projectId });
    
    // Check if user has access to this project
    const user = await User.findOne({ telegramId: userId, projects: projectId });
    
    if (!user) {
      return bot.sendMessage(chatId, `${emoji.error} You don't have access to this project.`);
    }
    
    // Check if user is admin
    const isAdmin = project.adminId === userId;
    
    // Generate message
    let message = `${emoji.team} *Team for "${project.name}"*\n\n`;
    
    if (teamMembers.length === 0) {
      message += 'No team members yet.';
    } else {
      teamMembers.forEach((member, index) => {
        message += `${index + 1}. *${member.name}* ${member.surname || ''} ${
          member.role ? `- ${member.role}` : ''
        } ${member.telegramId === project.adminId ? '(Admin)' : ''}\n`;
      });
    }
    
    // Create inline keyboard with options
    const buttons = [];
    
    if (isAdmin) {
      buttons.push([
        { text: `${emoji.addUser} Add Member`, callback_data: `add_member:${projectId}` }
      ]);
    }
    
    buttons.push([
      { text: `${emoji.back} Back to Project`, callback_data: `back_to_project:${projectId}` }
    ]);
    
    await bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error showing project team:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error loading the team. Please try again later.`
    );
  }
};

/**
 * Start user join project flow
 */
const startJoinProject = async (bot, chatId, userId) => {
  try {
    // Get user
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return bot.sendMessage(
        chatId,
        `${emoji.error} You are not registered. Please use /start to register.`
      );
    }
    
    // Set state
    sessionService.setState(userId, USER_STATES.WAITING_JOIN_PROJECT);
    
    await bot.sendMessage(
      chatId,
      `${emoji.project} *Join Project*\n\nPlease enter the project name you want to join:`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
      }
    );
    
  } catch (error) {
    console.error('Error starting join project flow:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
  }
};

/**
 * Handle project name input for joining
 */
const handleJoinProjectInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return bot.sendMessage(
      chatId,
      `${emoji.cancel} Join project cancelled.`,
      { ...keyboard.mainMenuKeyboard }
    );
  }
  
  try {
    // Find the project
    const project = await Project.findOne({ name: text });
    
    if (!project) {
      return bot.sendMessage(
        chatId,
        `${emoji.error} Project "${text}" not found. Please check the name and try again.`,
        {
          ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
        }
      );
    }
    
    // Get user
    const user = await User.findOne({ telegramId: userId });
    
    // Check if already a member
    if (user.projects.includes(project._id)) {
      sessionService.clearSession(userId);
      return bot.sendMessage(
        chatId,
        `${emoji.info} You are already a member of this project.`,
        { ...keyboard.mainMenuKeyboard }
      );
    }
    
    // Check if already sent a request
    if (user.pendingProjects.includes(project._id)) {
      sessionService.clearSession(userId);
      return bot.sendMessage(
        chatId,
        `${emoji.info} You already have a pending request to join this project.`,
        { ...keyboard.mainMenuKeyboard }
      );
    }
    
    // Add to pending projects
    user.pendingProjects.push(project._id);
    await user.save();
    
    // Notify project admin
    try {
      await bot.sendMessage(
        project.adminId,
        `${emoji.notification} *Join Request*\n\nUser *${user.name}* ${user.surname || ''} has requested to join your project "${project.name}".`,
        {
          parse_mode: 'Markdown',
          ...keyboard.createInlineKeyboard([
            [
              { text: `${emoji.select} Approve`, callback_data: `approve_join:${project._id}:${user.telegramId}` },
              { text: `${emoji.cancel} Reject`, callback_data: `reject_join:${project._id}:${user.telegramId}` }
            ]
          ])
        }
      );
    } catch (adminMessageError) {
      console.error('Error notifying admin:', adminMessageError);
      // Continue with the flow even if admin notification fails
    }
    
    // Clear session
    sessionService.clearSession(userId);
    
    await bot.sendMessage(
      chatId,
      `${emoji.success} Your request to join "${project.name}" has been sent to the project admin. You will be notified when they respond.`,
      { ...keyboard.mainMenuKeyboard }
    );
    
  } catch (error) {
    console.error('Error processing join project:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
    
    sessionService.clearSession(userId);
  }
};

/**
 * Handle callback queries for user management
 */
const handleUserCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  // Acknowledge the callback query
  await bot.answerCallbackQuery(callbackQuery.id);
  
  if (data.startsWith('approve_join:')) {
    const [_, projectId, requestUserId] = data.split(':');
    return approveJoinRequest(bot, chatId, userId, projectId, parseInt(requestUserId));
  }
  
  if (data.startsWith('reject_join:')) {
    const [_, projectId, requestUserId] = data.split(':');
    return rejectJoinRequest(bot, chatId, userId, projectId, parseInt(requestUserId));
  }
  
  if (data.startsWith('add_member:')) {
    const projectId = data.split(':')[1];
    return startAddMember(bot, chatId, userId, projectId);
  }
  
  // Other user-related callbacks would be handled here
};

/**
 * Approve a join request
 */
const approveJoinRequest = async (bot, chatId, adminId, projectId, requestUserId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== adminId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can approve join requests.`);
    }
    
    // Find the requesting user
    const requestUser = await User.findOne({ telegramId: requestUserId });
    
    if (!requestUser) {
      return bot.sendMessage(chatId, `${emoji.error} User not found.`);
    }
    
    // Check if the request is still pending
    if (!requestUser.pendingProjects.includes(projectId)) {
      return bot.sendMessage(chatId, `${emoji.error} No pending request found.`);
    }
    
    // Remove from pending and add to projects
    requestUser.pendingProjects = requestUser.pendingProjects.filter(p => p.toString() !== projectId.toString());
    requestUser.projects.push(projectId);
    await requestUser.save();
    
    // Notify admin
    await bot.sendMessage(
      chatId,
      `${emoji.success} You have approved ${requestUser.name} ${requestUser.surname || ''} to join "${project.name}".`
    );
    
    // Notify user
    try {
      await bot.sendMessage(
        requestUserId,
        `${emoji.notification} Your request to join the project "${project.name}" has been approved! You are now a team member.`
      );
    } catch (userMessageError) {
      console.error('Error notifying user:', userMessageError);
      // Continue even if user notification fails
    }
    
  } catch (error) {
    console.error('Error approving join request:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
  }
};

/**
 * Reject a join request
 */
const rejectJoinRequest = async (bot, chatId, adminId, projectId, requestUserId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== adminId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can reject join requests.`);
    }
    
    // Find the requesting user
    const requestUser = await User.findOne({ telegramId: requestUserId });
    
    if (!requestUser) {
      return bot.sendMessage(chatId, `${emoji.error} User not found.`);
    }
    
    // Check if the request is still pending
    if (!requestUser.pendingProjects.includes(projectId)) {
      return bot.sendMessage(chatId, `${emoji.error} No pending request found.`);
    }
    
    // Remove from pending
    requestUser.pendingProjects = requestUser.pendingProjects.filter(p => p.toString() !== projectId.toString());
    await requestUser.save();
    
    // Notify admin
    await bot.sendMessage(
      chatId,
      `${emoji.success} You have rejected ${requestUser.name} ${requestUser.surname || ''}'s request to join "${project.name}".`
    );
    
    // Notify user
    try {
      await bot.sendMessage(
        requestUserId,
        `${emoji.notification} Your request to join the project "${project.name}" has been rejected.`
      );
    } catch (userMessageError) {
      console.error('Error notifying user:', userMessageError);
      // Continue even if user notification fails
    }
    
  } catch (error) {
    console.error('Error rejecting join request:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
  }
};

/**
 * Start add member flow
 */
const startAddMember = async (bot, chatId, adminId, projectId) => {
  try {
    // Find the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return bot.sendMessage(chatId, `${emoji.error} Project not found.`);
    }
    
    // Check if user is admin
    if (project.adminId !== adminId) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin can add members.`);
    }
    
    // Get all users that are not already in the project
    const users = await User.find({ projects: { $ne: projectId } });
    
    if (users.length === 0) {
      return bot.sendMessage(
        chatId,
        `${emoji.info} There are no registered users that can be added to this project.`
      );
    }
    
    // Create inline keyboard with users
    const buttons = users.map(user => [
      { text: `${user.name} ${user.surname || ''}`, callback_data: `add_member_confirm:${projectId}:${user.telegramId}` }
    ]);
    
    buttons.push([
      { text: `${emoji.back} Back`, callback_data: `view_team:${projectId}` }
    ]);
    
    await bot.sendMessage(
      chatId,
      `${emoji.addUser} *Add Team Member*\n\nSelect a user to add to "${project.name}":`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error starting add member flow:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error processing your request. Please try again later.`
    );
  }
};

module.exports = {
  registerUser,
  handleNameInput,
  handleSurnameInput,
  handleRoleInput,
  handleContactInput,
  showUserProfile,
  showProjectTeam,
  startJoinProject,
  handleJoinProjectInput,
  handleUserCallback,
  USER_STATES
};