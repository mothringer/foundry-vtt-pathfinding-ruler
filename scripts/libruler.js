/*
For using Pathfinding Ruler with libRuler
Whenever the pathfinding tool icon is enabled, any ruler based on libRuler will use
pathfinding. This means the main Foundry ruler tool, plus any other such as if 
Drag Ruler were using libRuler.  

See https://github.com/caewok/foundryvtt-drag-ruler/tree/caewok-libruler for an example with Drag Ruler
See https://github.com/caewok/fvtt-speed-ruler for an example of how two modules might interact
*/

import { PathfindingRuler, findPath, MODULE_ID } from "./main.js";

/**
 * Measure the distance between two points and render the ruler UI to illustrate it.
 * This wrap is to update the waypoints using findPath whenever measure is called.
 * Easier than tracking onMouseMove and should result in less unnecessary processing.
 * @param {PIXI.Point} destination  The destination point to which to measure
 * @param {boolean} gridSpaces      Restrict measurement only to grid spaces
 */
export function pathfinderMeasure(wrapped, destination, options) {
  const token_controls = ui.controls.controls.find(elem => elem.name === "token");
  const pathfinding_control = token_controls.tools.find(elem => elem.name === "pathfinding-ruler");
  
  if(pathfinding_control?.active) {
    // this part adapted from main.js mousemoveListener
    const previous_endpoint = this.getFlag(MODULE_ID, "endpoint");
    const newlocation = PathfindingRuler.convertLocationToGridspace(destination);
    if(!previous_endpoint || previous_endpoint[0] !== newlocation[0] || previous_endpoint[1] !== newlocation[1]) {
      // we have moved destination to another gridspace. 
      this.setFlag(MODULE_ID, "endpoint", newlocation);
      
      // origin for pathfinding is the last user-set waypoint, 
      //   otherwise the origin waypoint
      let idx;
      for(idx = (this.waypoints.length - 1); idx >= 0; idx--) {
        if(!this.waypoints[idx]?.pathfinding) break;
      }
      const origin = this.waypoints[idx];
      const origin_grid = PathfindingRuler.convertLocationToGridspace(origin);
      if(PathfindingRuler.hitsWall(origin_grid, newlocation, true)) {
        // clear back to the last user waypoint
        for(let i = (this.waypoints.length - 1); i > idx; i--) {
          this._removeWaypoint(destination, {remeasure: false});
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
 * Wrap _addWaypoint to track when pathfinder (vs a user) adds a waypoint
 */
export function pathfinderAddWaypoint(wrapped, ...args) {
  // just capture the new waypoint number after it is added
  wrapped(...args)
  const pathfinding_active = this.getFlag(MODULE_ID, "pathfinding_active");
  if(pathfinding_active) {
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
 

