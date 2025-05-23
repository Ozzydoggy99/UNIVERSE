"use strict";
/**
 * Robot Map Data (Adapter Module)
 *
 * This module serves as an adapter to redirect old API calls
 * to the new improved dynamic-map-points system while maintaining
 * backward compatibility.
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
exports.fetchRobotMapPoints = fetchRobotMapPoints;
exports.normalizePointId = normalizePointId;
exports.getPointCoordinates = getPointCoordinates;
exports.getPoint = getPoint;
exports.getRobotPointsMap = getRobotPointsMap;
var dynamic_map_points_1 = require("./dynamic-map-points");
// Cache for robot points map
var robotPointsCache = {};
var lastCacheUpdate = 0;
var CACHE_TTL = 60000; // 1 minute cache TTL
/**
 * Adapter function to maintain backward compatibility with existing code
 * Redirects to the improved dynamic-map-points implementation
 */
function fetchRobotMapPoints() {
    return __awaiter(this, void 0, void 0, function () {
        var points;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[ADAPTER] Redirecting fetchRobotMapPoints call to fetchAllMapPoints');
                    return [4 /*yield*/, (0, dynamic_map_points_1.fetchAllMapPoints)()];
                case 1:
                    points = _a.sent();
                    updatePointsCache(points);
                    return [2 /*return*/, points];
            }
        });
    });
}
/**
 * Normalize point ID to standard format
 * Adapter function to maintain backward compatibility
 */
function normalizePointId(pointId) {
    if (!pointId)
        return '';
    var id = pointId.toString();
    // FIXED: If it already has _load or _docking, keep as is
    if (id.includes('_load') || id.includes('_docking')) {
        console.log("[ADAPTER] Point ".concat(id, " already has _load or _docking suffix, keeping as is"));
        return id;
    }
    // If it's a number only, add _load suffix (e.g., "110" -> "110_load")
    if (/^\d+$/.test(id)) {
        console.log("[ADAPTER] Adding _load suffix to numeric point ID: ".concat(id, " -> ").concat(id, "_load"));
        return "".concat(id, "_load");
    }
    // Special case for Drop-off points
    if (id.toLowerCase().includes('drop-off') || id.toLowerCase() === 'dropoff') {
        if (!id.includes('_load')) {
            console.log("[ADAPTER] Adding _load suffix to Drop-off point: ".concat(id, " -> ").concat(id, "_load"));
            return "".concat(id, "_load");
        }
        return id;
    }
    // Otherwise add _load
    console.log("[ADAPTER] Adding _load suffix to point ID: ".concat(id, " -> ").concat(id, "_load"));
    return "".concat(id, "_load");
}
/**
 * Adapter for getPointCoordinates
 */
function getPointCoordinates(pointId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log('[ADAPTER] Redirecting getPointCoordinates call to dynamic implementation');
            return [2 /*return*/, (0, dynamic_map_points_1.getPointCoordinates)(pointId)];
        });
    });
}
/**
 * Get a specific point by ID
 * @param pointId The point ID to look up
 */
function getPoint(pointId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("[ADAPTER] Getting point for ID: ".concat(pointId));
            return [2 /*return*/, getPointCoordinates(pointId)];
        });
    });
}
/**
 * Get the robot points map
 * This is an adapter for backwards compatibility
 */
function getRobotPointsMap() {
    return __awaiter(this, void 0, void 0, function () {
        var now, points;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    // Return cached map if valid
                    if (Object.keys(robotPointsCache).length > 0 && (now - lastCacheUpdate) < CACHE_TTL) {
                        console.log("[ADAPTER] Using cached robot points map (".concat(Object.keys(robotPointsCache).length, " points)"));
                        return [2 /*return*/, robotPointsCache];
                    }
                    // Otherwise fetch fresh data
                    console.log("[ADAPTER] Fetching fresh robot points map");
                    return [4 /*yield*/, (0, dynamic_map_points_1.fetchAllMapPoints)()];
                case 1:
                    points = _a.sent();
                    updatePointsCache(points);
                    return [2 /*return*/, robotPointsCache];
            }
        });
    });
}
/**
 * Update the points cache from a list of points
 */
function updatePointsCache(points) {
    robotPointsCache = {};
    // Convert points array to map for quick lookups
    for (var _i = 0, points_1 = points; _i < points_1.length; _i++) {
        var point = points_1[_i];
        if (point.id) {
            robotPointsCache[point.id] = point;
        }
    }
    lastCacheUpdate = Date.now();
    console.log("[ADAPTER] Updated points cache with ".concat(Object.keys(robotPointsCache).length, " points"));
}
