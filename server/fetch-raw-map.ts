/**
 * Fetch Raw Map Data Script
 *
 * This script fetches and prints the raw map data from the robot's API for map 4.
 */

import axios from 'axios';
import { getRobotApiUrl, getAuthHeaders, DEFAULT_ROBOT_SERIAL } from './robot-constants.js';

async function fetchRawMap() {
  try {
    const mapId = '4';
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const url = `${robotApiUrl}/maps/${mapId}`;
    console.log(`Fetching: ${url}`);
    console.log('Serial Number:', DEFAULT_ROBOT_SERIAL);
    console.log('Headers:', headers);
    const response = await axios.get(url, { headers, timeout: 10000 });
    console.log('Raw response from robot:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching raw map data:', error);
  }
}

fetchRawMap(); 