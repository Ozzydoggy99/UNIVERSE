"use strict";
/**
 * Robot Settings API Module
 *
 * Provides access to the robot's system settings and rack specifications
 * required for proper rack alignment operations.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRobotSystemSettings = fetchRobotSystemSettings;
exports.getRackSpecifications = getRackSpecifications;
exports.registerRobotSettingsRoutes = registerRobotSettingsRoutes;
var axios_1 = require("axios");
var robot_constants_1 = require("./robot-constants");
var DEFAULT_ROBOT_SERIAL = 'L382502104987ir';
/**
 * Fetch the complete robot system settings
 * These settings contain many configuration parameters for the robot
 * including rack specifications
 * @returns Complete system settings object
 */
function fetchRobotSystemSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var robotApiUrl, headers, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log('Fetching robot system settings...');
                    return [4 /*yield*/, (0, robot_constants_1.getRobotApiUrl)(DEFAULT_ROBOT_SERIAL)];
                case 1:
                    robotApiUrl = _a.sent();
                    return [4 /*yield*/, (0, robot_constants_1.getAuthHeaders)(DEFAULT_ROBOT_SERIAL)];
                case 2:
                    headers = _a.sent();
                    return [4 /*yield*/, axios_1.default.get("".concat(robotApiUrl, "/system/settings/effective"), {
                            headers: headers
                        })];
                case 3:
                    response = _a.sent();
                    if (!response.data) {
                        throw new Error('Invalid response from system settings endpoint');
                    }
                    console.log('Successfully retrieved robot system settings');
                    return [2 /*return*/, response.data];
                case 4:
                    error_1 = _a.sent();
                    console.error('Failed to fetch robot system settings:', error_1.message);
                    throw new Error("Failed to fetch robot system settings: ".concat(error_1.message));
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get rack specifications from the robot's system settings
 * These are required for proper rack alignment operations
 * @returns Rack specifications object
 */
function getRackSpecifications() {
    return __awaiter(this, void 0, void 0, function () {
        var settings, rackSpecs, _i, _a, key, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchRobotSystemSettings()];
                case 1:
                    settings = _b.sent();
                    // Log the keys at the root level to help debug
                    console.log('Available settings keys:', Object.keys(settings));
                    rackSpecs = null;
                    // Try to find rack.specs as a top-level property (flattened dot notation)
                    if (settings && settings["rack.specs"] && Array.isArray(settings["rack.specs"]) && settings["rack.specs"].length > 0) {
                        console.log('Found rack.specs as a top-level property with dot notation');
                        // Use the first spec in the array (most complete one)
                        rackSpecs = settings["rack.specs"][0];
                        console.log('Using rack spec:', rackSpecs);
                    }
                    else if (settings && settings.rack && settings.rack.specs) {
                        // Try the nested structure
                        console.log('Found rack.specs in nested structure');
                        rackSpecs = Array.isArray(settings.rack.specs) ? settings.rack.specs[0] : settings.rack.specs;
                    }
                    if (!rackSpecs) {
                        // Look for any property that might contain rack specifications
                        console.log('Searching for any property containing rack specs...');
                        for (_i = 0, _a = Object.keys(settings); _i < _a.length; _i++) {
                            key = _a[_i];
                            if (key.includes('rack') && settings[key]) {
                                console.log("Found potential rack-related key: ".concat(key));
                                // If it's an array, use the first element
                                if (Array.isArray(settings[key]) && settings[key].length > 0) {
                                    console.log("Key ".concat(key, " is an array with ").concat(settings[key].length, " items"));
                                    // If array elements have width and depth, it's likely the rack specs
                                    if (settings[key][0].width && settings[key][0].depth) {
                                        rackSpecs = settings[key][0];
                                        console.log("Using array element from ".concat(key, ":"), rackSpecs);
                                        break;
                                    }
                                }
                                // If it's an object with width and depth directly
                                else if (typeof settings[key] === 'object' && settings[key].width && settings[key].depth) {
                                    rackSpecs = settings[key];
                                    console.log("Using object from ".concat(key, ":"), rackSpecs);
                                    break;
                                }
                            }
                        }
                    }
                    if (!rackSpecs) {
                        console.error('Rack specifications not found in system settings');
                        throw new Error('Rack specifications not found in system settings');
                    }
                    // Ensure required fields are present
                    if (!rackSpecs.width || !rackSpecs.depth) {
                        console.error('Rack specifications incomplete - missing width or depth');
                        throw new Error('Rack specifications incomplete - missing width or depth');
                    }
                    // Create a standardized rack specs object with defaults for missing fields
                    return [2 /*return*/, {
                            width: rackSpecs.width,
                            depth: rackSpecs.depth,
                            leg_shape: rackSpecs.leg_shape || 'square', // Default to square if not specified
                            leg_size: rackSpecs.leg_size || 0.03, // Default to 3cm if not specified
                            margin: rackSpecs.margin || [0, 0, 0, 0], // Default to no margin if not specified
                            alignment: rackSpecs.alignment || 'center', // Default to center alignment if not specified
                            alignment_margin_back: rackSpecs.alignment_margin_back || 0.02 // Default to 2cm if not specified
                        }];
                case 2:
                    error_2 = _b.sent();
                    console.error('Failed to get rack specifications:', error_2.message);
                    throw new Error("Failed to get rack specifications: ".concat(error_2.message));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Register API routes for robot settings
 */
function registerRobotSettingsRoutes(app) {
    var _this = this;
    /**
     * GET /api/robot/settings
     * Get robot system settings
     */
    app.get('/api/robot/settings', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var settings, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchRobotSystemSettings()];
                case 1:
                    settings = _a.sent();
                    res.json(settings);
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error fetching robot settings:', error_3.message);
                    res.status(500).json({ error: "Failed to fetch robot settings: ".concat(error_3.message) });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    /**
     * GET /api/robot/settings/rack-specs
     * Get rack specifications for rack alignment operations
     */
    app.get('/api/robot/settings/rack-specs', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var rackSpecs, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getRackSpecifications()];
                case 1:
                    rackSpecs = _a.sent();
                    res.json(rackSpecs);
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error fetching rack specifications:', error_4.message);
                    res.status(500).json({ error: "Failed to fetch rack specifications: ".concat(error_4.message) });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
