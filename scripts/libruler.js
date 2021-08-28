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
      log(`${this.waypoints.length} waypoints.`, this.waypoints);
      let idx;
      for(idx = (this.waypoints.length - 1); idx >= 0; idx--) {
        if(!this.waypoints[idx]?.pathfinding) break;
      }
      const origin = this.waypoints[idx];
      log(`Last user waypoint index is ${idx} at ${origin.x}, ${origin.y}`, this.waypoints);
      const origin_grid = PathfindingRuler.convertLocationToGridspace(origin);
      if(PathfindingRuler.hitsWall(origin_grid, newlocation, true)) {
        // clear back to the last user waypoint
        for(let i = (this.waypoints.length - 1); i > idx; i--) {
          log(`Removing waypoint ${i}`);
          this._removeWaypoint(destination, {remeasure: false});
        }
        log(`Finding path from ${origin_grid[0]}, ${origin_grid[1]} to ${newlocation[0]}, ${newlocation[1]}`);
        this.setFlag(MODULE_ID, "pathfinding_active", true); // so addWaypoint can distinguish between user-added waypoints and pathfinding waypoints
        this.findPath(origin_grid, newlocation);
        this.setFlag(MODULE_ID, "pathfinding_active", false);
      }
    } 
  }

  wrapped(destination, options);
}

/*
 * Wrap _addWaypoint to track when pathfinder adds a waypoint
 */
export function pathfinderAddWaypoint(wrapped, ...args) {
  log("Adding waypoint");
  // just capture the new waypoint number after it is added
  wrapped(...args)
  const pathfinding_active = this.getFlag(MODULE_ID, "pathfinding_active");
  if(pathfinding_active) {
    log(`Marking waypoint ${this.waypoints.length - 1} as pathfinding`);
    this.waypoints[this.waypoints.length - 1].pathfinding = true; 
  }
}

/*
 * Wrap clear to remove tracking of user waypoints
 */
export function pathfinderClear(wrapped) {
  this.unsetFlag(MODULE_ID, "pathfinding_active");

  wrapped();
}
 

