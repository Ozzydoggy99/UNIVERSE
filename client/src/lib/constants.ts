// Define the physical robot serial number for use across the application
// This ensures we're always using the same robot for all operations
export const ROBOT_SERIAL = "L382502104987ir";

// Define the standard shelf/bin identifiers for simple display
export const SHELF_DISPLAY_NAMES = {
  // Map complex API point IDs to simplified human-readable names
  "104_Load": "104",
  "105_Load": "105",
  "106_Load": "106",
  "107_Load": "107",
  "108_Load": "108",
  "109_Load": "109",
  "110_Load": "110"
};

// Define service types for consistent usage
export const SERVICE_TYPES = {
  LAUNDRY: "laundry",
  TRASH: "trash"
};

// Define operation types for consistent usage
export const OPERATION_TYPES = {
  PICKUP: "pickup",
  DROPOFF: "dropoff"
};