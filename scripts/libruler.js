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



Hooks.once('libRulerReady', async function() {
  Object.defineProperty(Ruler.prototype, "findPath", {
    value: findPath,
    writable: true,
    configurable: true
  });
  
  libWrapper.register(MODULE_ID, 'Ruler.prototype.measure', pathfinderMeasure, 'WRAPPER');
}

// wrap measure -- whenever measure is called, update the waypoints
// easier than tracking onMouseMove and should result in less unnecessary processing
/**
 * Measure the distance between two points and render the ruler UI to illustrate it
 * @param {PIXI.Point} destination  The destination point to which to measure
 * @param {boolean} gridSpaces      Restrict measurement only to grid spaces
 */
function pathfinderMeasure(wrapped, destination, options) {
  if(game.activeTool === "pathfinding-ruler") {
  
    // this part adapted from main.js mousemoveListener
    const previous_endpoint = this.getFlag(MODULE_ID, "endpoint");
    const newlocation = PathfindingRuler.convertLocationToGridspace(destination);
    if(!previous_endpoint || previous_endpoint[0] !== newlocation[0] || previous_endpoint[1] !== newlocation[1]) {
      // we have moved destination to another gridspace. 
      this.setFlag(MODULE_ID, "endpoint", newlocation);
    
      const origin_grid = PathfindingRuler.convertLocationToGridSpace(this.origin);
      if(PathfindingRuler.hitsWall(origin_grid, newlocation, true)) {
        this.findPath(origin_grid, newlocation);
      }
    } 
  }

  wrapped(destination, options);
}


