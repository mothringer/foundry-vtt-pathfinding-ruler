/*
 *	This program is free software: you can redistribute it and/or modify
 *	it under the terms of the GNU General Public License as published by
 *	the Free Software Foundation, either version 3 of the License, or
 *	(at your option) any later version.
 *
 *	This program is distributed in the hope that it will be useful,
 *	but WITHOUT ANY WARRANTY; without even the implied warranty of
 *	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
 *	GNU General Public License for more details.
 *
 *	You should have received a copy of the GNU General Public License
 *	along with this program.	If not, see <https://www.gnu.org/licenses/>.
 */
"use strict"

import { pathfinderMeasure } from "./libruler.js";

const MODULE_ID = "pathfinding-ruler";

function log(...args) {
  try {
      console.log(MODULE_ID, '|', ...args);
  } catch (e) {}
}


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
});

class Config
{
	constructor()
	{
		game.settings.register("pathfinding-ruler", "GMOnly",
		{
			name: game.i18n.localize("pathfinding-ruler.GMOnly.name"),
			hint: game.i18n.localize("pathfinding-ruler.GMOnly.hint"),
			scope: "world",
			config: true,
			default: false,
			type: Boolean,
		});
		game.settings.register("pathfinding-ruler", "MaxDistance",
		{
			name: game.i18n.localize("pathfinding-ruler.MaxDistance.name"),
			hint: game.i18n.localize("pathfinding-ruler.MaxDistance.hint"),
			scope: "client",
			config: true,
			default: 40,
			type: Number,
		});
		/*game.settings.register("pathfinding-ruler", "pathfinderDiagonals",
		{
			name: game.i18n.localize("pathfinding-ruler.pathfinderDiagonals.name"),
			hint: game.i18n.localize("pathfinding-ruler.pathfinderDiagonals.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		});*/
	}
}

export class PathfindingRuler
{
	constructor()
	{
		this.config = new Config();
		this.origin = [0,0];
		this.endpoint = [0,0];
		this.ruler;
		this.waypoints;
		this.isActive;

		PathfindingRuler.setSceneControlHooks();
		this.setCanvasHooks();
	}
	
static setSceneControlHooks() {	 
		Hooks.on("getSceneControlButtons", (buttons) => {
			let tokenButton = buttons.find((button) => button.name === "token");
			if (tokenButton)
			{
				let tool = {};
				if (game.settings.get("pathfinding-ruler", "GMOnly"))
				{
					tool = {
						name: "pathfinding-ruler",
						title: game.i18n.localize("pathfinding-ruler.toolname"),
						layer: "TokenLayer",
						icon: "fas fa-route",
						visible: game.user.isGM
					};
				}
				else
				{
					tool = {
						name: "pathfinding-ruler",
						title: game.i18n.localize("pathfinding-ruler.toolname"),
						layer: "TokenLayer",
						icon: "fas fa-route",
						visible: true
					};
				}
				
				if(game.modules.get('libruler')?.active) {
				  tool.toggle = true;
				  tool.active = false; // start inactive after loading game
				}
				
				tokenButton.tools.push(tool);
			}
		}); 
}

setCanvasHooks() {
		Hooks.on("canvasReady", () => {
			canvas.stage.on("mousemove", (event) => this.mousemoveListener(event));
			this.ruler = canvas.controls._rulers[game.user._id];
		});
	}

	
	mousemoveListener(event)
	{
		if (game.activeTool === "pathfinding-ruler")
		{
			let newlocation = PathfindingRuler.convertLocationToGridspace(event.data.getLocalPosition(canvas.grid));
			if (this.endpoint[0] !== newlocation[0] || this.endpoint[1] !== newlocation[1])
			{
//log(`mousemove newlocation ${newlocation[0]}, ${newlocation[1]}`, this);
				this.endpoint = newlocation;
				let token = canvas.tokens.controlled[0];
				if (token)
				{
					this.origin = PathfindingRuler.convertLocationToGridspace(token.center);
					let origin = PathfindingRuler.convertGridspaceToLocation(this.origin);
					this.isActive = true;
					if (!PathfindingRuler.hitsWall(this.origin,this.endpoint,true))
					{
						this.waypoints = [new PIXI.Point(origin.x,origin.y)];
						this.removeRuler();
						this.drawRuler();
					}
					else
					{
						this.findPath(this.origin, this.endpoint);
					}
				}
				else
				{
					if (this.isActive)
					{
						this.removeRuler();
						this.isActive = false;
					}
				}
			}
		}
		else
		{
			if (this.isActive)
			{
				this.removeRuler();
				this.isActive = false;
			}
		}
	}
	
	drawRuler()
	{
		let newruler = this.ruler;
		let endpoint = PathfindingRuler.convertGridspaceToLocation(this.endpoint);
		newruler._state = 2;
		newruler.waypoints = this.waypoints.splice(0);
		newruler.destination = new PIXI.Point(endpoint.x,endpoint.y);
		while ( newruler.waypoints.length > newruler.labels.children.length) 
		{
			newruler.labels.addChild(new PreciseText("", CONFIG.canvasTextStyle));
		}
		newruler.class = "Ruler";
		this.ruler.update(newruler.toJSON());
	}
	
	removeRuler()
	{
		this.ruler.clear();
	}
	
	static convertLocationToGridspace(location)
	{
			let gridspace = canvas.grid.getCenter(location.x,location.y);
			gridspace[0] = (gridspace[0] / canvas.grid.size) - .5;
			gridspace[1] = (gridspace[1] / canvas.grid.size) - .5;
			return gridspace;
	}
	
	static convertGridspaceToLocation(gridspace)
	{
		let location = {x:0,y:0};
		if (Array.isArray(gridspace))
		{
			location.x = gridspace[0];
			location.y = gridspace[1];
		}
		else 
		{
			location.x = gridspace.x;
			location.y = gridspace.y;
		}
		location.x = (location.x + .5 ) * canvas.grid.size;
		location.y = (location.y + .5 ) * canvas.grid.size;
		return location;
	}

	printDebugToChat(content)
	{
			let chatData = {
				user: game.user._id,
				speaker: ChatMessage.getSpeaker(),
				content: content,
				type: CONST.CHAT_MESSAGE_TYPES.IC,
			}

			ChatMessage.create(chatData, {chatBubble : true })
	}
	
	static hitsWall(A, B, isGridspace)
	{
		if (isGridspace)
		{
			A = PathfindingRuler.convertGridspaceToLocation(A);
			B = PathfindingRuler.convertGridspaceToLocation(B);
		}
		let ray = new Ray(A,B);
		if (ray)
			return canvas.walls.checkCollision(ray,{blockMovement:true, blockSenses:false, mode:"any"});
		else return true;
	}
	
	static rebuildGrid()
	{
		const grid = [];
	
		for (let x = 0;x<(canvas.grid._width/canvas.grid.size);x++)
		{
			grid[x] = [];
			for (let y = 0;y<(canvas.grid._height/canvas.grid.size);y++)
			{
				grid[x][y]={};
				grid[x][y].x=x;
				grid[x][y].y=y;
				grid[x][y].f=0;
				grid[x][y].g=0;
				grid[x][y].h=0;
				grid[x][y].parent=null;
			}
		}
		return grid;
	}
	
	static isInList(list, node)
	{
		for (let i=0; i<list.length; i++)
		{
			if (list[i].x === node.x && list[i].y === node.y)
				return true;
		}
		return false;
	}
	
	static isValidNode(node)
	{
		return (node.y >= 0 && node.y < (canvas.grid._height/canvas.grid.size) && node.x >= 0 && node.x < (canvas.grid._width/canvas.grid.size));
	}
	
	static getNeighbors(node, grid)
	{
		let neighbors = [];
		let x = node.x;
		let y = node.y;
		for (let i=-1; i<2; i++)
		{
			for (let j=-1;j<2;j++)
			{
				if (!(i===0 && j===0)&&PathfindingRuler.isValidNode({x:x+i,y:y+j}))
					neighbors.push(grid[x+i][y+j]);
			}
		}
		return neighbors;
	}
	
	static heuristic(start,end)
	{
		let xdistance = Math.abs(start.x-end.x);
		let ydistance = Math.abs(start.y-end.y);
		if (xdistance>ydistance) return (xdistance+(ydistance/2));
		else return (ydistance+(xdistance/2));
	}
	
	static pruneWaypoints(waypointlist)
	{
		let i=0;
		while(i<waypointlist.length-2)
		{
			if (!PathfindingRuler.hitsWall(waypointlist[i],waypointlist[i+2],false))
			{
				waypointlist.splice(i+1,1);
			}
			else
			{
				i++;
			}
		}
	}
}


Hooks.on("init", () => {
	if(!game.modules.get('libruler')?.active) {
		const pathfindingRuler = new PathfindingRuler();
	} else {
		 // we need to instantiate the config settings b/c we are not creating the full Pathfinder Class from main.js
		new Config();
		PathfindingRuler.setSceneControlHooks();
	}
});


export function findPath(origin, endpoint)
	{
                log(`findPath origin ${origin[0]}, ${origin[1]}; destination ${endpoint[0]}, ${endpoint[1]}`, this);
    const use_libruler = game.modules.get('libruler')?.active;
		const grid = PathfindingRuler.rebuildGrid();
		endpoint = {x:endpoint[0],y:endpoint[1]};
		let openList = [];
		let closedList = [];
		openList.push(grid[origin[0]][origin[1]]);
		
		while (openList.length > 0)
		{
			let lowIndex = 0;
			for (let i=0; i<openList.length; i++)
			{
				if (openList[i].f < openList[lowIndex].f) {lowIndex = i}
			}
			let currentNode = openList[lowIndex];
			if (currentNode.f > game.settings.get("pathfinding-ruler", "MaxDistance"))
			{
				if(!use_libruler) this.removeRuler();
				return;
			}
			if (currentNode.x=== endpoint.x && currentNode.y === endpoint.y)
			{
				if(!use_libruler) this.removeRuler();
				let current = currentNode;
				let ret = [];
				while(current.parent)
				{
					let loc = [current.x, current.y];
					loc = PathfindingRuler.convertGridspaceToLocation(loc);
					ret.push(loc);
					current = current.parent;
				}
				
				if(!use_libruler) this.waypoints = []; // will clear the waypoints in Ruler.measure wrap (see libruler.js)
				const origin_loc = PathfindingRuler.convertGridspaceToLocation(origin);
				ret.push(origin_loc);
				PathfindingRuler.pruneWaypoints(ret);
				for (let i=ret.length-1;i>0;i--) {
				  if(use_libruler) {
				    this.addWaypoint(ret[i]);
				  } else {
				    this.waypoints.push(new PIXI.Point(ret[i].x,ret[i].y));
				  }
				}
				if(!use_libruler) this.drawRuler();
				return;
			}
			openList.splice(lowIndex,1);
			closedList.push(currentNode);
			
			let neighbors = PathfindingRuler.getNeighbors(currentNode, grid);
			for(let i=0;i<neighbors.length;i++)
			{
				let neighbor = neighbors[i];
				if (PathfindingRuler.isInList(closedList,neighbor) || PathfindingRuler.hitsWall(currentNode,neighbor,true))
					continue;
				
				let gScore = 0;
				if (currentNode.x === neighbor.x || currentNode.y === neighbor.y)
					gScore = currentNode.g + 1;
				else gScore = currentNode.g + 1.5;
				let gScoreIsBest = false;
				
				if (!PathfindingRuler.isInList(openList,neighbor))
				{
					gScoreIsBest = true;
					neighbor.h = PathfindingRuler.heuristic(neighbor,endpoint)
					openList.push(neighbor);
				}
				else if (gScore < neighbor.g)
				{
					gScoreIsBest = true;
				}
				if (gScoreIsBest)
				{
					neighbor.parent = currentNode;
					neighbor.g = gScore;
					neighbor.f = neighbor.g + neighbor.h;
				}
			}
		}
		if(!use_libruler) this.removeRuler();
	}
	
Object.defineProperty(PathfindingRuler.prototype, "findPath", {
	value: findPath,
	writable: true,
	configurable: true
});
