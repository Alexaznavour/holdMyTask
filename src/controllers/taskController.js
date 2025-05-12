const { Task, Project, User } = require('../models');
const emoji = require('../utils/emoji');
const keyboard = require('../utils/keyboard');
const sessionService = require('../services/sessionService');
const moment = require('moment');

// States for task flow
const TASK_STATES = {
  CREATING: 'creating_task',
  WAITING_NAME: 'waiting_task_name',
  WAITING_DESCRIPTION: 'waiting_task_description',
  WAITING_DUE_DATE: 'waiting_task_due_date',
  WAITING_TASK_TYPE: 'waiting_task_type',
  WAITING_ROLE_TYPE: 'waiting_task_role_type',
  WAITING_PRIORITY: 'waiting_task_priority',
  WAITING_EFFORT: 'waiting_task_effort',
  WAITING_ASSIGNEE: 'waiting_task_assignee',
  EDITING: 'editing_task',
  DELETING: 'deleting_task'
};

/**
 * Show tasks menu
 */
const showTasksMenu = async (bot, chatId, userId) => {
  // Clear any existing session state
  sessionService.setState(userId, null);
  
  // Get user's projects
  const user = await User.findOne({ telegramId: userId });
  
  if (!user) {
    return bot.sendMessage(chatId, `${emoji.error} You are not registered. Please use /start to register.`);
  }
  
  // Create keyboard with options
  const buttons = [
    [`${emoji.task} My Tasks`],
    [`${emoji.todo} To Do`, `${emoji.inProgress} In Progress`],
    [`${emoji.done} Done`],
    [`${emoji.back} Back to Menu`]
  ];
  
  // Add "Create Task" button if user has projects
  if (user.projects && user.projects.length > 0) {
    buttons.unshift([`${emoji.task} Create New Task`]);
  }
  
  await bot.sendMessage(
    chatId, 
    `${emoji.tasks} *Tasks*\n\nSelect an option:`,
    {
      parse_mode: 'Markdown',
      ...keyboard.createKeyboard(buttons)
    }
  );
};

/**
 * Start task creation flow
 */
const startTaskCreation = async (bot, chatId, userId) => {
  try {
    // Get user's projects
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return bot.sendMessage(chatId, `${emoji.error} You are not registered. Please use /start to register.`);
    }
    
    if (!user.projects || user.projects.length === 0) {
      return bot.sendMessage(chatId, `${emoji.error} You need to be a member of at least one project to create tasks.`);
    }
    
    // If user has only one project, use that one
    if (user.projects.length === 1) {
      const projectId = user.projects[0];
      sessionService.setState(userId, TASK_STATES.WAITING_NAME);
      sessionService.setData(userId, 'projectId', projectId);
      
      await bot.sendMessage(
        chatId,
        `${emoji.task} *Create New Task*\n\nPlease enter a name for your task:`,
        {
          parse_mode: 'Markdown',
          ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
        }
      );
      
      return;
    }
    
    // If user has multiple projects, let them choose
    const projects = await Project.find({ _id: { $in: user.projects } });
    const buttons = projects.map(project => [
      { text: project.name, callback_data: `create_task:${project._id}` }
    ]);
    
    buttons.push([
      { text: `${emoji.cancel} Cancel`, callback_data: 'cancel_task_creation' }
    ]);
    
    await bot.sendMessage(
      chatId,
      `${emoji.task} *Create New Task*\n\nPlease select a project for this task:`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createInlineKeyboard(buttons)
      }
    );
    
  } catch (error) {
    console.error('Error starting task creation:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error starting task creation. Please try again later.`
    );
  }
};

/**
 * Handle task name input
 */
const handleTaskNameInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return showTasksMenu(bot, chatId, userId);
  }
  
  // Store the task name and ask for description
  sessionService.setState(userId, TASK_STATES.WAITING_DESCRIPTION);
  sessionService.setData(userId, 'taskName', text);
  
  await bot.sendMessage(
    chatId,
    `${emoji.task} Please enter a description for your task (or type "skip" to skip):`,
    {
      ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle task description input
 */
const handleTaskDescriptionInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return showTasksMenu(bot, chatId, userId);
  }
  
  let description = text;
  if (text === 'Skip') {
    description = '';
  }
  
  // Store description and ask for due date
  sessionService.setState(userId, TASK_STATES.WAITING_DUE_DATE);
  sessionService.setData(userId, 'taskDescription', description);
  
  await bot.sendMessage(
    chatId,
    `${emoji.calendar} Please enter a due date for the task (format: YYYY-MM-DD) or type "skip" to skip:`,
    {
      ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
    }
  );
};

/**
 * Handle task due date input
 */
const handleTaskDueDateInput = async (bot, chatId, userId, text) => {
  if (text === `${emoji.cancel} Cancel`) {
    sessionService.clearSession(userId);
    return showTasksMenu(bot, chatId, userId);
  }
  
  let dueDate = null;
  
  if (text !== 'Skip') {
    // Validate date format
    if (!moment(text, 'YYYY-MM-DD', true).isValid()) {
      return bot.sendMessage(
        chatId,
        `${emoji.error} Invalid date format. Please use the format YYYY-MM-DD or type "skip" to skip.`,
        {
          ...keyboard.createKeyboard([[`Skip`, `${emoji.cancel} Cancel`]])
        }
      );
    }
    
    dueDate = new Date(text);
  }
  
  // Store due date and ask for task type
  sessionService.setState(userId, TASK_STATES.WAITING_TASK_TYPE);
  sessionService.setData(userId, 'taskDueDate', dueDate);
  
  await bot.sendMessage(
    chatId,
    `${emoji.task} Please select the task type:`,
    {
      ...keyboard.createKeyboard([
        [`${emoji.feature} Feature`, `${emoji.research} Research`, `${emoji.bug} Bug`],
        [`${emoji.cancel} Cancel`]
      ])
    }
  );
};

/**
 * Show user's tasks for today
 */
const showTodayTasks = async (bot, chatId, userId) => {
  try {
    // Get user
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return bot.sendMessage(chatId, `${emoji.error} You are not registered. Please use /start to register.`);
    }
    
    // Find all tasks assigned to the user
    const tasks = await Task.find({ 
      assignedTo: user._id,
      status: { $ne: 'done' }
    }).populate('projectId');
    
    // Filter for tasks due today or past due
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() <= today.getTime();
    });
    
    if (todayTasks.length === 0) {
      return bot.sendMessage(
        chatId,
        `${emoji.info} You have no tasks scheduled for today.`,
        { ...keyboard.backButton }
      );
    }
    
    let message = `${emoji.calendar} *Your Tasks For Today*\n\n`;
    
    todayTasks.forEach((task, index) => {
      const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
      const statusEmoji = task.status === 'todo' ? emoji.todo : emoji.inProgress;
      const priorityEmoji = 
        task.priority === 'high' ? emoji.highPriority :
        task.priority === 'medium' ? emoji.mediumPriority :
        emoji.lowPriority;
      
      message += `${index + 1}. ${statusEmoji} ${priorityEmoji} *${task.name}*\n`;
      message += `   Project: ${projectName}\n`;
      message += `   Status: ${task.status}\n`;
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const isOverdue = dueDate < today;
        message += `   Due: ${dueDate.toDateString()} ${isOverdue ? '⚠️ OVERDUE' : ''}\n`;
      }
      message += '\n';
    });
    
    await bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard.backButton
      }
    );
    
  } catch (error) {
    console.error('Error showing today tasks:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error loading your tasks. Please try again later.`
    );
  }
};

/**
 * Show task details
 */
const showTaskDetails = async (bot, chatId, userId, taskId) => {
  try {
    // Find the task
    const task = await Task.findById(taskId)
      .populate('projectId')
      .populate('assignedTo')
      .populate('createdBy');
    
    if (!task) {
      return bot.sendMessage(chatId, `${emoji.error} Task not found.`);
    }
    
    // Find the user to check project membership
    const user = await User.findOne({ telegramId: userId });
    
    if (!user.projects.includes(task.projectId._id)) {
      return bot.sendMessage(chatId, `${emoji.error} You don't have access to this task.`);
    }
    
    // Get project and check if user is admin
    const project = await Project.findById(task.projectId._id);
    const isAdmin = project.adminId === userId;
    const isAssignee = task.assignedTo && task.assignedTo._id.equals(user._id);
    
    // Format task details
    const statusEmoji = 
      task.status === 'todo' ? emoji.todo :
      task.status === 'in-progress' ? emoji.inProgress :
      emoji.done;
    
    const priorityEmoji = 
      task.priority === 'high' ? emoji.highPriority :
      task.priority === 'medium' ? emoji.mediumPriority :
      emoji.lowPriority;
    
    const typeEmoji = 
      task.taskType === 'feature' ? emoji.feature :
      task.taskType === 'research' ? emoji.research :
      emoji.bug;
    
    let message = `${emoji.task} *${task.name}*\n\n`;
    
    if (task.description) {
      message += `${task.description}\n\n`;
    }
    
    message += `${emoji.project} *Project:* ${task.projectId.name}\n`;
    message += `${statusEmoji} *Status:* ${task.status}\n`;
    message += `${typeEmoji} *Type:* ${task.taskType}\n`;
    message += `${priorityEmoji} *Priority:* ${task.priority}\n`;
    
    if (task.dueDate) {
      message += `${emoji.deadline} *Due Date:* ${task.dueDate.toDateString()}\n`;
    }
    
    if (task.effort) {
      message += `${emoji.clock} *Effort:* ${task.effort} day(s)\n`;
    }
    
    if (task.roleType) {
      message += `${emoji.user} *Role:* ${task.roleType}\n`;
    }
    
    if (task.assignedTo) {
      message += `${emoji.user} *Assigned To:* ${task.assignedTo.name} ${task.assignedTo.surname || ''}\n`;
    } else {
      message += `${emoji.user} *Assigned To:* Unassigned\n`;
    }
    
    message += `${emoji.info} *Created By:* ${task.createdBy.name} ${task.createdBy.surname || ''}\n`;
    message += `${emoji.calendar} *Created:* ${task.createdAt.toDateString()}\n`;
    
    if (task.completedAt) {
      message += `${emoji.done} *Completed:* ${task.completedAt.toDateString()}\n`;
    }
    
    // Create inline keyboard with options
    const buttons = [];
    
    // Add action buttons if user is admin or assignee
    if (isAdmin || isAssignee) {
      const statusButtons = [];
      
      if (task.status !== 'todo') {
        statusButtons.push({ text: `${emoji.todo} To Do`, callback_data: `task_status:${task._id}:todo` });
      }
      
      if (task.status !== 'in-progress') {
        statusButtons.push({ text: `${emoji.inProgress} In Progress`, callback_data: `task_status:${task._id}:in-progress` });
      }
      
      if (task.status !== 'done') {
        statusButtons.push({ text: `${emoji.done} Done`, callback_data: `task_status:${task._id}:done` });
      }
      
      if (statusButtons.length > 0) {
        buttons.push(statusButtons);
      }
      
      if (isAdmin) {
        buttons.push([
          { text: `${emoji.editTask} Edit`, callback_data: `edit_task:${task._id}` },
          { text: `${emoji.deleteTask} Delete`, callback_data: `delete_task:${task._id}` }
        ]);
      }
    }
    
    buttons.push([
      { text: `${emoji.back} Back`, callback_data: `back_to_tasks` }
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
    console.error('Error showing task details:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error loading the task details. Please try again later.`
    );
  }
};

/**
 * Handle callback queries for tasks
 */
const handleTaskCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  // Acknowledge the callback query
  await bot.answerCallbackQuery(callbackQuery.id);
  
  if (data.startsWith('create_task:')) {
    const projectId = data.split(':')[1];
    sessionService.setState(userId, TASK_STATES.WAITING_NAME);
    sessionService.setData(userId, 'projectId', projectId);
    
    await bot.sendMessage(
      chatId,
      `${emoji.task} *Create New Task*\n\nPlease enter a name for your task:`,
      {
        parse_mode: 'Markdown',
        ...keyboard.createKeyboard([[`${emoji.cancel} Cancel`]])
      }
    );
    return;
  }
  
  if (data === 'cancel_task_creation') {
    sessionService.clearSession(userId);
    return showTasksMenu(bot, chatId, userId);
  }
  
  if (data.startsWith('task_status:')) {
    const [_, taskId, status] = data.split(':');
    return updateTaskStatus(bot, chatId, userId, taskId, status);
  }
  
  // Other task-related callbacks would be handled here
};

/**
 * Update task status
 */
const updateTaskStatus = async (bot, chatId, userId, taskId, newStatus) => {
  try {
    // Find the task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return bot.sendMessage(chatId, `${emoji.error} Task not found.`);
    }
    
    // Check if user can update this task
    const user = await User.findOne({ telegramId: userId });
    const project = await Project.findById(task.projectId);
    
    if (!user.projects.includes(task.projectId)) {
      return bot.sendMessage(chatId, `${emoji.error} You don't have access to this task.`);
    }
    
    const isAdmin = project.adminId === userId;
    const isAssignee = task.assignedTo && task.assignedTo.equals(user._id);
    
    if (!isAdmin && !isAssignee) {
      return bot.sendMessage(chatId, `${emoji.error} Only the project admin or the assignee can update this task.`);
    }
    
    // Update the task status
    const oldStatus = task.status;
    task.status = newStatus;
    
    // If task is marked as done, set completed date
    if (newStatus === 'done' && oldStatus !== 'done') {
      task.completedAt = new Date();
    } else if (newStatus !== 'done') {
      task.completedAt = null;
    }
    
    await task.save();
    
    // Show updated task
    await showTaskDetails(bot, chatId, userId, taskId);
    
    // If task is marked as done, send notification to project admin
    if (newStatus === 'done' && oldStatus !== 'done' && !isAdmin) {
      try {
        await bot.sendMessage(
          project.adminId,
          `${emoji.notification} *Task Completed*\n\nTask "${task.name}" in project "${project.name}" has been marked as done by ${user.name} ${user.surname || ''}.`,
          { parse_mode: 'Markdown' }
        );
      } catch (adminMessageError) {
        console.error('Error notifying admin:', adminMessageError);
        // Continue even if admin notification fails
      }
    }
    
  } catch (error) {
    console.error('Error updating task status:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error updating the task status. Please try again later.`
    );
  }
};

/**
 * Show user's tasks
 */
const showMyTasks = async (bot, chatId, userId) => {
  try {
    // Get user
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return bot.sendMessage(chatId, `${emoji.error} You are not registered. Please use /start to register.`);
    }
    
    // Find all tasks assigned to the user
    const tasks = await Task.find({ 
      assignedTo: user._id
    }).populate('projectId');
    
    if (tasks.length === 0) {
      return bot.sendMessage(
        chatId,
        `${emoji.info} You have no tasks assigned to you.`,
        { ...keyboard.backButton }
      );
    }
    
    // Group tasks by status
    const groupedTasks = {
      todo: [],
      'in-progress': [],
      done: []
    };
    
    tasks.forEach(task => {
      groupedTasks[task.status].push(task);
    });
    
    let message = `${emoji.task} *Your Tasks*\n\n`;
    
    // To Do tasks
    if (groupedTasks.todo.length > 0) {
      message += `${emoji.todo} *To Do (${groupedTasks.todo.length})*\n`;
      groupedTasks.todo.forEach((task, index) => {
        const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
        const dueDate = task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : 'No due date';
        
        message += `${index + 1}. *${task.name}*\n`;
        message += `   Project: ${projectName} | Due: ${dueDate}\n`;
      });
      message += '\n';
    }
    
    // In Progress tasks
    if (groupedTasks['in-progress'].length > 0) {
      message += `${emoji.inProgress} *In Progress (${groupedTasks['in-progress'].length})*\n`;
      groupedTasks['in-progress'].forEach((task, index) => {
        const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
        const dueDate = task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : 'No due date';
        
        message += `${index + 1}. *${task.name}*\n`;
        message += `   Project: ${projectName} | Due: ${dueDate}\n`;
      });
      message += '\n';
    }
    
    // Done tasks
    if (groupedTasks.done.length > 0) {
      message += `${emoji.done} *Done (${groupedTasks.done.length})*\n`;
      groupedTasks.done.forEach((task, index) => {
        const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
        const completedDate = task.completedAt ? moment(task.completedAt).format('YYYY-MM-DD') : 'Unknown';
        
        message += `${index + 1}. *${task.name}*\n`;
        message += `   Project: ${projectName} | Completed: ${completedDate}\n`;
      });
    }
    
    await bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        ...keyboard.backButton
      }
    );
    
  } catch (error) {
    console.error('Error showing user tasks:', error);
    await bot.sendMessage(
      chatId,
      `${emoji.error} There was an error loading your tasks. Please try again later.`
    );
  }
};

module.exports = {
  showTasksMenu,
  startTaskCreation,
  handleTaskNameInput,
  handleTaskDescriptionInput,
  handleTaskDueDateInput,
  showTodayTasks,
  showTaskDetails,
  handleTaskCallback,
  showMyTasks,
  TASK_STATES
}; 