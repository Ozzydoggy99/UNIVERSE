/**
 * Robot Task Monitor
 * 
 * This utility allows administrators to monitor the robot's current tasks,
 * including detailed step-by-step progress and safety status.
 * 
 * Usage:
 *   node monitor-robot-tasks.js [--follow]
 * 
 * Options:
 *   --follow: Continuously monitor tasks (like 'tail -f')
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ROBOT_API_URL, ROBOT_SECRET } = require('./server/robot-constants');

// Constants
const MISSION_QUEUE_FILE = path.join(process.cwd(), 'robot-mission-queue.json');
const ROBOT_DEBUG_LOG = path.join(process.cwd(), 'robot-debug.log');
const REFRESH_INTERVAL = 5000; // 5 seconds
const FOLLOW_MODE = process.argv.includes('--follow');

// Headers for robot API
const headers = { 'x-api-key': ROBOT_SECRET };

// ANSI color codes for better visualization
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
  },
  
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
  }
};

/**
 * Main function to monitor robot tasks
 */
async function monitorRobotTasks() {
  console.log(`${colors.bright}${colors.fg.cyan}===== ROBOT TASK MONITOR =====${colors.reset}`);
  
  // Show continuous information if in follow mode
  if (FOLLOW_MODE) {
    console.log(`${colors.fg.yellow}Follow mode enabled. Press Ctrl+C to exit.${colors.reset}`);
    monitorLoop();
  } else {
    await showTaskStatus();
  }
}

/**
 * Continuous monitoring loop
 */
async function monitorLoop() {
  while (true) {
    try {
      // Clear screen for better visibility
      process.stdout.write('\033c');
      
      await showTaskStatus();
      console.log(`\n${colors.fg.gray}Refreshing in 5 seconds...${colors.reset}`);
      
      // Wait for the next refresh
      await new Promise(resolve => setTimeout(resolve, REFRESH_INTERVAL));
    } catch (error) {
      console.error(`${colors.fg.red}Error monitoring tasks: ${error.message}${colors.reset}`);
      break;
    }
  }
}

/**
 * Show current robot task status
 */
async function showTaskStatus() {
  const currentTime = new Date().toLocaleTimeString();
  console.log(`${colors.fg.gray}Last updated: ${currentTime}${colors.reset}\n`);
  
  // 1. Check current robot position
  await showRobotPosition();
  
  // 2. Check robot battery
  await showRobotBattery();
  
  // 3. Check emergency status
  await checkEmergencyStatus();
  
  // 4. Show current mission queue
  await showMissionQueue();
  
  // 5. Show recent debug logs
  await showRecentLogs();
}

/**
 * Show the robot's current position
 */
async function showRobotPosition() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers });
    const pose = response.data;
    
    console.log(`${colors.bright}${colors.fg.cyan}Robot Position:${colors.reset}`);
    console.log(`  X: ${colors.fg.yellow}${pose.x.toFixed(3)}${colors.reset}, Y: ${colors.fg.yellow}${pose.y.toFixed(3)}${colors.reset}, Orientation: ${colors.fg.yellow}${(pose.ori * 180 / Math.PI).toFixed(1)}°${colors.reset}`);
  } catch (error) {
    console.log(`${colors.fg.red}Could not fetch robot position: ${error.message}${colors.reset}`);
  }
}

/**
 * Show the robot's current battery status
 */
async function showRobotBattery() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/device/battery`, { headers });
    const battery = response.data;
    
    // Determine color based on battery level
    let batteryColor = colors.fg.green;
    if (battery.percentage < 30) batteryColor = colors.fg.red;
    else if (battery.percentage < 50) batteryColor = colors.fg.yellow;
    
    console.log(`${colors.bright}${colors.fg.cyan}Battery Status:${colors.reset}`);
    console.log(`  Level: ${batteryColor}${battery.percentage.toFixed(1)}%${colors.reset}, Charging: ${battery.is_charging ? colors.fg.green + 'Yes' : colors.fg.yellow + 'No'}${colors.reset}`);
  } catch (error) {
    console.log(`${colors.fg.red}Could not fetch battery status: ${error.message}${colors.reset}`);
  }
}

/**
 * Check if the robot is in emergency stop state
 */
async function checkEmergencyStatus() {
  try {
    // Try to check using jack_up endpoint (will fail with specific message if e-stop is pressed)
    try {
      await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      console.log(`${colors.bright}${colors.fg.cyan}Emergency Status:${colors.reset} ${colors.fg.green}No emergency stop detected${colors.reset}`);
    } catch (error) {
      if (error.response && error.response.status === 500 && 
          error.response.data && error.response.data.detail &&
          error.response.data.detail.includes("Emergency stop button is pressed")) {
        console.log(`${colors.bright}${colors.fg.cyan}Emergency Status:${colors.reset} ${colors.bg.red}${colors.fg.white}EMERGENCY STOP PRESSED${colors.reset}`);
      } else {
        console.log(`${colors.bright}${colors.fg.cyan}Emergency Status:${colors.reset} ${colors.fg.green}No emergency stop detected${colors.reset}`);
      }
    }
  } catch (error) {
    console.log(`${colors.fg.red}Could not check emergency status: ${error.message}${colors.reset}`);
  }
}

/**
 * Show the current mission queue
 */
async function showMissionQueue() {
  try {
    if (!fs.existsSync(MISSION_QUEUE_FILE)) {
      console.log(`${colors.bright}${colors.fg.cyan}Mission Queue:${colors.reset} ${colors.fg.yellow}No mission queue file found${colors.reset}`);
      return;
    }
    
    const queueData = fs.readFileSync(MISSION_QUEUE_FILE, 'utf8');
    const missions = JSON.parse(queueData);
    
    console.log(`${colors.bright}${colors.fg.cyan}Mission Queue:${colors.reset}`);
    
    if (missions.length === 0) {
      console.log(`  ${colors.fg.yellow}No active missions${colors.reset}`);
      return;
    }
    
    // Show active missions first
    const activeMissions = missions.filter(m => m.status === 'pending' || m.status === 'in_progress');
    const otherMissions = missions.filter(m => m.status !== 'pending' && m.status !== 'in_progress');
    
    if (activeMissions.length > 0) {
      console.log(`  ${colors.bright}${colors.underscore}Active Missions:${colors.reset}`);
      activeMissions.forEach(mission => {
        printMission(mission);
      });
    }
    
    if (otherMissions.length > 0 && otherMissions.length <= 5) {
      console.log(`\n  ${colors.bright}${colors.underscore}Recent Completed/Failed Missions:${colors.reset}`);
      otherMissions.slice(0, 5).forEach(mission => {
        printMission(mission);
      });
    }
  } catch (error) {
    console.log(`${colors.fg.red}Error reading mission queue: ${error.message}${colors.reset}`);
  }
}

/**
 * Print details of a single mission
 */
function printMission(mission) {
  // Determine status color
  let statusColor = colors.fg.blue;
  if (mission.status === 'completed') statusColor = colors.fg.green;
  else if (mission.status === 'failed') statusColor = colors.fg.red;
  else if (mission.status === 'in_progress') statusColor = colors.fg.yellow;
  
  // Calculate progress percentage
  const totalSteps = mission.steps.length;
  const completedSteps = mission.steps.filter(s => s.completed).length;
  const progress = Math.round((completedSteps / totalSteps) * 100);
  
  // Create progress bar
  const progressBarWidth = 20;
  const filledWidth = Math.round((progress / 100) * progressBarWidth);
  const emptyWidth = progressBarWidth - filledWidth;
  
  const progressBar = 
    colors.fg.green + '█'.repeat(filledWidth) + 
    colors.fg.gray + '░'.repeat(emptyWidth) + 
    colors.reset;
  
  console.log(`  Mission: ${colors.bright}${mission.name}${colors.reset} (ID: ${mission.id})`);
  console.log(`    Status: ${statusColor}${mission.status.toUpperCase()}${colors.reset}, Robot: ${colors.fg.cyan}${mission.robotSn}${colors.reset}`);
  console.log(`    Progress: ${progressBar} ${colors.fg.yellow}${progress}%${colors.reset} (${completedSteps}/${totalSteps} steps)`);
  console.log(`    Created: ${new Date(mission.createdAt).toLocaleString()}`);
  
  // Show steps with status
  console.log(`    ${colors.underscore}Steps:${colors.reset}`);
  mission.steps.forEach((step, index) => {
    const current = index === mission.currentStepIndex;
    const stepNumber = `      ${index + 1}.`.padEnd(7);
    let statusIndicator;
    
    if (current && mission.status === 'in_progress') {
      statusIndicator = colors.fg.yellow + '→ ' + colors.reset;
    } else if (step.completed) {
      statusIndicator = colors.fg.green + '✓ ' + colors.reset; 
    } else {
      statusIndicator = colors.fg.gray + '○ ' + colors.reset;
    }
    
    // Format step description
    let stepDesc = `${colors.dim}${step.type}${colors.reset}`;
    if (step.type === 'move') {
      stepDesc = `${colors.dim}move to ${step.params.label || `(${step.params.x.toFixed(2)}, ${step.params.y.toFixed(2)})`}${colors.reset}`;
    } else if (step.type === 'jack_up') {
      stepDesc = `${colors.bright}${colors.fg.yellow}JACK UP${colors.reset}`;
    } else if (step.type === 'jack_down') {
      stepDesc = `${colors.bright}${colors.fg.yellow}JACK DOWN${colors.reset}`;
    }
    
    // Add error if present
    if (step.errorMessage) {
      stepDesc += ` ${colors.fg.red}[ERROR: ${step.errorMessage}]${colors.reset}`;
    }
    
    console.log(`${stepNumber}${statusIndicator}${stepDesc}`);
  });
  
  console.log('');
}

/**
 * Show recent robot debug logs
 */
async function showRecentLogs() {
  try {
    if (!fs.existsSync(ROBOT_DEBUG_LOG)) {
      console.log(`${colors.bright}${colors.fg.cyan}Recent Logs:${colors.reset} ${colors.fg.yellow}No robot debug log found${colors.reset}`);
      return;
    }
    
    const logData = fs.readFileSync(ROBOT_DEBUG_LOG, 'utf8');
    const logLines = logData.trim().split('\n');
    
    console.log(`${colors.bright}${colors.fg.cyan}Recent Robot Logs:${colors.reset}`);
    
    // Show last 10 log lines
    const recentLogs = logLines.slice(-10);
    recentLogs.forEach(line => {
      // Colorize logs
      let coloredLine = line;
      
      if (line.includes('ERROR') || line.includes('❌')) {
        coloredLine = colors.fg.red + line + colors.reset;
      } else if (line.includes('WARNING') || line.includes('⚠️')) {
        coloredLine = colors.fg.yellow + line + colors.reset;
      } else if (line.includes('SUCCESS') || line.includes('✅')) {
        coloredLine = colors.fg.green + line + colors.reset;
      } else if (line.includes('INFO') || line.includes('ℹ️')) {
        coloredLine = colors.fg.blue + line + colors.reset;
      }
      
      console.log(`  ${coloredLine}`);
    });
  } catch (error) {
    console.log(`${colors.fg.red}Error reading robot debug log: ${error.message}${colors.reset}`);
  }
}

// Start monitoring
monitorRobotTasks().catch(error => {
  console.error(`${colors.fg.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});