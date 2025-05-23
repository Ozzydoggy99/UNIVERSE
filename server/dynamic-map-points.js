"use strict";
/**
 * Dynamic Map Points Service
 *
 * This service fetches map points directly from the robot API in real-time,
 * allowing the system to automatically use newly added map points without
 * requiring code changes or deployments.
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
exports.fetchAllMapPoints = fetchAllMapPoints;
exports.getPointCoordinates = getPointCoordinates;
exports.getAllShelfPoints = getAllShelfPoints;
exports.refreshPointsCache = refreshPointsCache;
var axios_1 = require("axios");
var robot_constants_1 = require("./robot-constants");
// Cache of map points with TTL for performance
var pointsCache = [];
var lastFetchTime = 0;
var CACHE_TTL = 60000; // 1 minute cache validity
/**
 * Fetch all map points directly from the robot
 */
function fetchAllMapPoints() {
    return __awaiter(this, void 0, void 0, function () {
        var now, mapsResponse, _a, _b, _c, _d, maps, activeMap, mapDetailRes, _e, _f, _g, _h, mapData, overlays, features, points, shelfPoints, error_1;
        var _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    now = Date.now();
                    // Return cached points if still valid
                    if (pointsCache.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
                        console.log("[DYNAMIC-MAP] Using cached points (".concat(pointsCache.length, " points)"));
                        return [2 /*return*/, pointsCache];
                    }
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 8, , 9]);
                    console.log("[DYNAMIC-MAP] Fetching points from robot API...");
                    _b = (_a = axios_1.default).get;
                    _c = "".concat;
                    return [4 /*yield*/, (0, robot_constants_1.getRobotApiUrl)('L382502104987ir')];
                case 2:
                    _d = [_c.apply("", [_l.sent(), "/maps"])];
                    _j = {};
                    return [4 /*yield*/, (0, robot_constants_1.getAuthHeaders)('L382502104987ir')];
                case 3: return [4 /*yield*/, _b.apply(_a, _d.concat([(_j.headers = _l.sent(),
                            _j)]))];
                case 4:
                    mapsResponse = _l.sent();
                    maps = mapsResponse.data;
                    if (!Array.isArray(maps) || maps.length === 0) {
                        console.error("[DYNAMIC-MAP] No maps found from robot API");
                        return [2 /*return*/, []];
                    }
                    activeMap = maps[0];
                    console.log("[DYNAMIC-MAP] Using map: ".concat(activeMap.name || activeMap.map_name, " (ID: ").concat(activeMap.id, ")"));
                    _f = (_e = axios_1.default).get;
                    _g = "".concat;
                    return [4 /*yield*/, (0, robot_constants_1.getRobotApiUrl)('L382502104987ir')];
                case 5:
                    _h = [_g.apply("", [_l.sent(), "/maps/"]).concat(activeMap.id)];
                    _k = {};
                    return [4 /*yield*/, (0, robot_constants_1.getAuthHeaders)('L382502104987ir')];
                case 6: return [4 /*yield*/, _f.apply(_e, _h.concat([(_k.headers = _l.sent(),
                            _k)]))];
                case 7:
                    mapDetailRes = _l.sent();
                    mapData = mapDetailRes.data;
                    if (!mapData || !mapData.overlays) {
                        console.error("[DYNAMIC-MAP] No overlay data in map");
                        return [2 /*return*/, []];
                    }
                    overlays = void 0;
                    try {
                        overlays = JSON.parse(mapData.overlays);
                    }
                    catch (e) {
                        console.error("[DYNAMIC-MAP] Failed to parse overlays JSON");
                        return [2 /*return*/, []];
                    }
                    features = overlays.features || [];
                    console.log("[DYNAMIC-MAP] Found ".concat(features.length, " features in map overlays"));
                    points = features
                        .filter(function (f) { var _a; return ((_a = f.geometry) === null || _a === void 0 ? void 0 : _a.type) === 'Point' && f.properties; })
                        .map(function (f) {
                        var properties = f.properties, geometry = f.geometry;
                        var id = String(properties.name || properties.text || '').trim();
                        var x = typeof properties.x === 'number' ? properties.x : geometry.coordinates[0];
                        var y = typeof properties.y === 'number' ? properties.y : geometry.coordinates[1];
                        var theta = parseFloat(String(properties.yaw || properties.orientation || '0'));
                        return { id: id, x: x, y: y, theta: theta };
                    });
                    if (points.length > 0) {
                        console.log("[DYNAMIC-MAP] Successfully extracted ".concat(points.length, " map points"));
                        shelfPoints = points.filter(function (p) {
                            return /^\d+(_load)?$/.test(p.id) ||
                                p.id.includes('_load');
                        });
                        console.log("[DYNAMIC-MAP] Found ".concat(shelfPoints.length, " shelf points:"));
                        shelfPoints.forEach(function (p) {
                            console.log("[DYNAMIC-MAP] - ".concat(p.id, ": (").concat(p.x, ", ").concat(p.y, ")"));
                        });
                        // Update cache
                        pointsCache = points;
                        lastFetchTime = now;
                        return [2 /*return*/, points];
                    }
                    console.error("[DYNAMIC-MAP] No point features found in map overlays");
                    return [2 /*return*/, []];
                case 8:
                    error_1 = _l.sent();
                    console.error("[DYNAMIC-MAP] Error fetching map points:", error_1);
                    // Return cached points as fallback
                    if (pointsCache.length > 0) {
                        console.log("[DYNAMIC-MAP] Using cached points as fallback");
                        return [2 /*return*/, pointsCache];
                    }
                    return [2 /*return*/, []];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get coordinates for a specific point ID
 *
 * This improved version specifically fixes the original "110_load" point detection bug
 * by trying multiple variations of the point ID format.
 */
function getPointCoordinates(pointId) {
    return __awaiter(this, void 0, void 0, function () {
        var allPoints, point, normalizedId_1, alternateIds, _loop_1, _i, alternateIds_1, altId, state_1, numericMatches, loadPoint, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pointId) {
                        console.error("[DYNAMIC-MAP] Cannot get coordinates for empty point ID");
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("[DYNAMIC-MAP] Looking up coordinates for point: ".concat(pointId));
                    return [4 /*yield*/, fetchAllMapPoints()];
                case 2:
                    allPoints = _a.sent();
                    point = allPoints.find(function (p) { return p.id === pointId; });
                    // If found with exact match, return immediately
                    if (point) {
                        console.log("[DYNAMIC-MAP] \u2705 Found exact match for ".concat(pointId, ": (").concat(point.x, ", ").concat(point.y, ")"));
                        return [2 /*return*/, point];
                    }
                    // Try case-insensitive match with original ID
                    point = allPoints.find(function (p) { return p.id.toLowerCase() === pointId.toLowerCase(); });
                    if (point) {
                        console.log("[DYNAMIC-MAP] \u2705 Found case-insensitive match for ".concat(pointId, ": (").concat(point.x, ", ").concat(point.y, ")"));
                        return [2 /*return*/, point];
                    }
                    normalizedId_1 = normalizePointId(pointId);
                    console.log("[DYNAMIC-MAP] Original point not found, trying normalized ID: ".concat(normalizedId_1));
                    // Try exact match with normalized ID
                    point = allPoints.find(function (p) { return p.id === normalizedId_1; });
                    if (point) {
                        console.log("[DYNAMIC-MAP] \u2705 Found coordinates for normalized ID ".concat(normalizedId_1, ": (").concat(point.x, ", ").concat(point.y, ")"));
                        return [2 /*return*/, point];
                    }
                    // Try case-insensitive match with normalized ID
                    point = allPoints.find(function (p) { return p.id.toLowerCase() === normalizedId_1.toLowerCase(); });
                    if (point) {
                        console.log("[DYNAMIC-MAP] \u2705 Found case-insensitive match for normalized ID ".concat(normalizedId_1, ": (").concat(point.x, ", ").concat(point.y, ")"));
                        return [2 /*return*/, point];
                    }
                    alternateIds = generateAlternateIds(pointId);
                    console.log("[DYNAMIC-MAP] Trying alternate formats for ".concat(pointId, ": ").concat(alternateIds.join(', ')));
                    _loop_1 = function (altId) {
                        point = allPoints.find(function (p) { return p.id.toLowerCase() === altId.toLowerCase(); });
                        if (point) {
                            console.log("[DYNAMIC-MAP] \u2705 Found coordinates using alternate ID ".concat(altId, ": (").concat(point.x, ", ").concat(point.y, ")"));
                            return { value: point };
                        }
                    };
                    for (_i = 0, alternateIds_1 = alternateIds; _i < alternateIds_1.length; _i++) {
                        altId = alternateIds_1[_i];
                        state_1 = _loop_1(altId);
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                    }
                    // Special fallback for numeric IDs (like "110")
                    if (/^\d+$/.test(pointId)) {
                        numericMatches = allPoints.filter(function (p) {
                            return p.id.startsWith(pointId) ||
                                p.id.includes("_".concat(pointId)) ||
                                p.id.includes("".concat(pointId, "_"));
                        });
                        if (numericMatches.length > 0) {
                            loadPoint = numericMatches.find(function (p) { return p.id.includes('_load'); });
                            if (loadPoint) {
                                console.log("[DYNAMIC-MAP] \u2705 Found numeric-based match with _load: ".concat(loadPoint.id));
                                return [2 /*return*/, loadPoint];
                            }
                            // Otherwise use the first match
                            console.log("[DYNAMIC-MAP] \u2705 Found numeric-based match: ".concat(numericMatches[0].id));
                            return [2 /*return*/, numericMatches[0]];
                        }
                    }
                    console.error("[DYNAMIC-MAP] \u274C Could not find coordinates for ".concat(pointId, " (normalized: ").concat(normalizedId_1, ")"));
                    console.log("[DYNAMIC-MAP] Available points: ".concat(allPoints.map(function (p) { return p.id; }).join(', ')));
                    return [2 /*return*/, null];
                case 3:
                    error_2 = _a.sent();
                    console.error("[DYNAMIC-MAP] Error getting point coordinates:", error_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get all shelf points (for dropdowns and UI)
 */
function getAllShelfPoints() {
    return __awaiter(this, void 0, void 0, function () {
        var allPoints, shelfPoints;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchAllMapPoints()];
                case 1:
                    allPoints = _a.sent();
                    shelfPoints = allPoints.filter(function (p) {
                        return /^\d+$/.test(p.id) ||
                            p.id.toLowerCase().includes('_load');
                    });
                    console.log("[DYNAMIC-MAP] Filtered ".concat(shelfPoints.length, " shelf points from ").concat(allPoints.length, " total points"));
                    return [2 /*return*/, shelfPoints];
            }
        });
    });
}
/**
 * Normalize point ID to standard format
 *
 * This corrected version specifically handles the original bug with "110_load" point format.
 * It prevents unnecessarily adding _load suffix to IDs that already have it.
 */
function normalizePointId(pointId) {
    if (!pointId)
        return '';
    var id = pointId.toString();
    // FIXED: If it already has _load or _docking, keep as is
    if (id.includes('_load') || id.includes('_docking')) {
        console.log("[DYNAMIC-MAP] Point ".concat(id, " already has _load or _docking suffix, keeping as is"));
        return id;
    }
    // If it's a number only, add _load suffix (e.g., "110" -> "110_load")
    if (/^\d+$/.test(id)) {
        console.log("[DYNAMIC-MAP] Adding _load suffix to numeric point ID: ".concat(id, " -> ").concat(id, "_load"));
        return "".concat(id, "_load");
    }
    // Special case for Drop-off points
    if (id.toLowerCase().includes('drop-off') || id.toLowerCase() === 'dropoff') {
        if (!id.includes('_load')) {
            console.log("[DYNAMIC-MAP] Adding _load suffix to Drop-off point: ".concat(id, " -> ").concat(id, "_load"));
            return "".concat(id, "_load");
        }
        return id;
    }
    // Otherwise add _load
    console.log("[DYNAMIC-MAP] Adding _load suffix to point ID: ".concat(id, " -> ").concat(id, "_load"));
    return "".concat(id, "_load");
}
/**
 * Generate alternate point IDs to try
 */
function generateAlternateIds(pointId) {
    var alternateIds = [];
    // For example, if passed "110_load", also try "110", "110_load_docking"
    if (pointId.endsWith('_load')) {
        var baseId = pointId.replace('_load', '');
        alternateIds.push(baseId);
        alternateIds.push("".concat(baseId, "_load_docking"));
    }
    // If passed a base ID like "110", try with _load and _docking
    else if (/^\d+$/.test(pointId)) {
        alternateIds.push("".concat(pointId, "_load"));
        alternateIds.push("".concat(pointId, "_load_docking"));
    }
    return alternateIds;
}
/**
 * Force refresh the cache
 */
function refreshPointsCache() {
    console.log("[DYNAMIC-MAP] Clearing points cache to force refresh");
    pointsCache = [];
    lastFetchTime = 0;
}
