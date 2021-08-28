/*
For using Pathfinding Ruler with libRuler
Whenever the pathfinding tool icon is enabled, any ruler based on libRuler will use
pathfinding. This means the main Foundry ruler tool, plus any other such as if 
Drag Ruler were using libRuler.  

See https://github.com/caewok/foundryvtt-drag-ruler/tree/caewok-libruler for an example with Drag Ruler
See https://github.com/caewok/fvtt-speed-ruler for an example of how two modules might interact
*/

import { PathfindingRuler, findPath } from "./main.js";

const MODULE_ID = "pathfinding-ruler"

function log(...args) {
  try {
      console.log(MODULE_ID, '|', ...args);
  } catch (e) {}
}

/*
Hooks.once('libRulerReady', async function() {
  log(`libRuler is ready; adding findPath`);
  Object.defineProperty(Ruler.prototype, "findPath", {
    value: findPath,
    writable: true,
    configurable: true
  });
  
  log(`registering Ruler.measure`);
  libWrapper.register(MODULE_ID, 'Ruler.prototype.measure', pathfinderMeasure, 'WRAPPER');
  log(`done registration!`);
};
*/

// wrap measure -- whenever measure is called, update the waypoints
// easier than tracking onMouseMove and should result in less unnecessary processing
/**
 * Measure the distance between two points and render the ruler UI to illustrate it
 * @param {PIXI.Point} destination  The destination point to which to measure
 * @param {boolean} gridSpaces      Restrict measurement only to grid spaces
 */
export function pathfinderMeasure(wrapped, destination, options) {
  const token_controls = ui.controls.controls.find(elem => elem.name === "token");
  const pathfinding_control = token_controls.tools.find(elem => elem.name === "pathfinding-ruler");
  
  if(pathfinding_control?.active) {
    log(`measure: pathfinding control is active.`);    
    // this part adapted from main.js mousemoveListener
    const previous_endpoint = this.getFlag(MODULE_ID, "endpoint");
    const newlocation = PathfindingRuler.convertLocationToGridspace(destination);
    if(!previous_endpoint || previous_endpoint[0] !== newlocation[0] || previous_endpoint[1] !== newlocation[1]) {
      // we have moved destination to another gridspace. 
      this.setFlag(MODULE_ID, "endpoint", newlocation);
      
      // origin for pathfinding is the last user-set waypoint, 
      //   otherwise the origin waypoint
      const user_waypoint_indices = this.getFlag(MODULE_ID, "user_waypoint_indices") || [];
      const last_user_waypoint = user_waypoint_indices.reduce((a, b) => Math.max(a,b), Number.NEGATIVE_INFINITY);
      log(`Last user waypoint index is ${last_user_waypoint}`, this.waypoints, user_waypoint_indices);
      const origin = this.waypoints[last_user_waypoint];
    
      const origin_grid = PathfindingRuler.convertLocationToGridspace(origin);
      if(PathfindingRuler.hitsWall(origin_grid, newlocation, true)) {
        // clear back to the last user waypoint
        for(let i = (this.waypoints.length - 1); i > last_user_waypoint; i--) {
          this._removeWaypoint(destination, {remeasure = false});
        }
        this.setFlag(MODULE_ID, "pathfinding_active", true); // so addWaypoint can distinguish between user-added waypoints and pathfinding waypoints
        this.findPath(origin_grid, newlocation);
        this.setFlag(MODULE_ID, "pathfinding_active", false);
      }
    } 
  }

  wrapped(destination, options);
}

/*
 * Wrap _addWaypoint to track when the user adds a waypoint
 */
export function pathfinderAddWaypoint(wrapped, ...args) {
  // just capture the new waypoint number after it is added
  wrapped(...args)
  
  const pathfinding_active = this.getFlag(MODULE_ID, "pathfinding_active");
  if(!pathfinding_active) {
    const user_waypoint_indices = this.getFlag(MODULE_ID, "user_waypoint_indices") || [];
    user_waypoint_indices.push(this.waypoints.length - 1); // last one is the newly added
    this.setFlag(MODULE_ID, "user_waypoint_indices", user_waypoint_indices);
  }
}

/*
 * Wrap _removeWaypoint to track when the user removes a waypoint
 */
export function pathfinderRemoveWaypoint(wrapped, ...args) {
  let user_waypoint_indices = this.getFlag(MODULE_ID, "user_waypoint_indices") || [];
  user_waypoint_indices = user_waypoint_indices.filter(elem => elem < (this.waypoints.length - 2); // -2 b/c we will be removing the last waypoint below
  this.setFlag(MODULE_ID, "user_waypoint_indices", user_waypoint_indices);
  
  wrapped(...args);
}

/*
 * Wrap clear to remove tracking of user waypoints
 */
export function pathfinderClear(wrapped) {
  this.unsetFlag(MODULE_ID, "user_waypoint_indices");
  this.unsetFlag(MODULE_ID, "pathfinding_active");

  wrapped();
}
 

