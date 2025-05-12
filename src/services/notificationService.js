const { Task, User, Project } = require('../models');
const emoji = require('../utils/emoji');
const moment = require('moment');

/**
 * Service to handle task notifications
 */
class NotificationService {
  constructor(bot) {
    this.bot = bot;
  }
  
  /**
   * Check for overdue tasks and send notifications
   */
  async checkOverdueTasks() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find overdue tasks that are not done
      const overdueTasks = await Task.find({
        dueDate: { $lt: today },
        status: { $ne: 'done' }
      }).populate('projectId').populate('assignedTo');
      
      // Group tasks by user
      const tasksByUser = {};
      
      overdueTasks.forEach(task => {
        if (task.assignedTo) {
          const userId = task.assignedTo.telegramId;
          
          if (!tasksByUser[userId]) {
            tasksByUser[userId] = [];
          }
          
          tasksByUser[userId].push(task);
        }
      });
      
      // Send notifications to each user
      for (const userId in tasksByUser) {
        const tasks = tasksByUser[userId];
        
        if (tasks.length === 0) continue;
        
        let message = `${emoji.notification} *Overdue Tasks Reminder*\n\n`;
        message += `You have ${tasks.length} overdue task(s):\n\n`;
        
        tasks.forEach((task, index) => {
          const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
          const dueDate = moment(task.dueDate).format('YYYY-MM-DD');
          
          message += `${index + 1}. *${task.name}*\n`;
          message += `   Project: ${projectName}\n`;
          message += `   Due Date: ${dueDate}\n`;
          message += `   Status: ${task.status}\n\n`;
        });
        
        // Send notification
        try {
          await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error(`Error sending overdue notification to user ${userId}:`, error);
        }
      }
      
      console.log(`Checked ${overdueTasks.length} overdue tasks`);
    } catch (error) {
      console.error('Error checking overdue tasks:', error);
    }
  }
  
  /**
   * Check for upcoming tasks due soon (tomorrow) and send notifications
   */
  async checkUpcomingTasks() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      // Find tasks due tomorrow that are not done
      const upcomingTasks = await Task.find({
        dueDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
        status: { $ne: 'done' }
      }).populate('projectId').populate('assignedTo');
      
      // Group tasks by user
      const tasksByUser = {};
      
      upcomingTasks.forEach(task => {
        if (task.assignedTo) {
          const userId = task.assignedTo.telegramId;
          
          if (!tasksByUser[userId]) {
            tasksByUser[userId] = [];
          }
          
          tasksByUser[userId].push(task);
        }
      });
      
      // Send notifications to each user
      for (const userId in tasksByUser) {
        const tasks = tasksByUser[userId];
        
        if (tasks.length === 0) continue;
        
        let message = `${emoji.notification} *Upcoming Tasks Reminder*\n\n`;
        message += `You have ${tasks.length} task(s) due tomorrow:\n\n`;
        
        tasks.forEach((task, index) => {
          const projectName = task.projectId ? task.projectId.name : 'Unknown Project';
          
          message += `${index + 1}. *${task.name}*\n`;
          message += `   Project: ${projectName}\n`;
          message += `   Status: ${task.status}\n\n`;
        });
        
        // Send notification
        try {
          await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error(`Error sending upcoming notification to user ${userId}:`, error);
        }
      }
      
      console.log(`Checked ${upcomingTasks.length} upcoming tasks`);
    } catch (error) {
      console.error('Error checking upcoming tasks:', error);
    }
  }
  
  /**
   * Start notification service
   */
  start() {
    // Check overdue tasks every morning (9 AM)
    this.scheduleDaily(9, 0, () => this.checkOverdueTasks());
    
    // Check upcoming tasks every evening (6 PM)
    this.scheduleDaily(18, 0, () => this.checkUpcomingTasks());
    
    console.log('Notification service started');
  }
  
  /**
   * Schedule a function to run at a specific time each day
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @param {Function} callback - Function to run
   */
  scheduleDaily(hour, minute, callback) {
    const now = new Date();
    let scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0
    );
    
    // If the time has already passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilExecution = scheduledTime - now;
    
    // Schedule first execution
    const timer = setTimeout(() => {
      callback();
      
      // Then set up interval for subsequent executions (every 24 hours)
      setInterval(callback, 24 * 60 * 60 * 1000);
    }, timeUntilExecution);
    
    return timer;
  }
}

module.exports = NotificationService; 