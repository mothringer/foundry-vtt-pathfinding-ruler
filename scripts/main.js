/*
 *	This program is free software: you can redistribute it and/or modify
 *	it under the terms of the GNU General Public License as published by
 *	the Free Software Foundation, either version 3 of the License, or
 *	(at your option) any later version.
 *
 *	This program is distributed in the hope that it will be useful,
 *	but WITHOUT ANY WARRANTY; without even the implied warranty of
 *	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *	GNU General Public License for more details.
 *
 *	You should have received a copy of the GNU General Public License
 *	along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
"use strict"

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
		});
	
		game.settings.register("pathfinding-ruler", "printMoveToChat",
		{
			name: game.i18n.localize("pathfinding-ruler.printMoveToChat.name"),
			hint: game.i18n.localize("pathfinding-ruler.printMoveToChat.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		});*/
	}
}

class PathfindingRuler
{
	constructor()
	{
		this.config = new Config();
		this.origin = [0,0];
		this.endpoint = [0,0];
		this.ruler;
		this.waypoints;
		this.grid = [];

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
						visible: isGM
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
				tokenButton.tools.push(tool);
			}
		});

		Hooks.on("canvasReady", () => {
			canvas.stage.on("mousemove", (event) => this.mousemoveListener(event));
			this.ruler = canvas.controls._rulers[game.user._id];
		});
	}
	
	
	mousemoveListener(event)
	{
		if (game.activeTool === "pathfinding-ruler")
		{
			let newlocation = this.convertLocationToGridspace(event.data.getLocalPosition(canvas.grid));
			if (this.endpoint[0] !== newlocation[0] || this.endpoint[1] !== newlocation[1])
			{
				this.endpoint = newlocation;
				let token = canvas.tokens.controlled[0];
				if (token)
				{
					this.origin = this.convertLocationToGridspace(token.center);
					let origin = this.convertGridspaceToLocation(this.origin);
					this.waypoints = [new PIXI.Point(origin.x,origin.y)];
					if (!this.hitsWall(this.origin,this.endpoint))
					{
						this.drawRuler();
					}
					else
					{
						this.findPath();
					}
				}
				else
				{
					this.removeRuler();
				}
			}
		}
		else
		{
			this.removeRuler();
		}
	}
	
	drawRuler()
	{
		let newruler = this.ruler;
		let endpoint = this.convertGridspaceToLocation(this.endpoint);
		newruler._state = 2;
		newruler.waypoints = this.waypoints;
		newruler.destination = new PIXI.Point(endpoint.x,endpoint.y);
		newruler.class = "Ruler";
		this.ruler.update(newruler);
	}
	
	removeRuler()
	{
		let newruler = this.ruler;
		newruler._state = 0;
		newruler.waypoints = [];
		newruler.destination = [];
		newruler.class = "Ruler";
		this.ruler.update(newruler)
	}
	
	convertLocationToGridspace(location)
	{
			let gridspace = canvas.grid.getCenter(location.x,location.y);
			gridspace[0] = (gridspace[0] / canvas.grid.size) - .5;
			gridspace[1] = (gridspace[1] / canvas.grid.size) - .5;
			return gridspace;
	}
	
	convertGridspaceToLocation(gridspace)
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
	
	hitsWall(A, B)
	{
		let ray = new Ray(this.convertGridspaceToLocation(A),this.convertGridspaceToLocation(B));
		if (ray)
			return WallsLayer.getRayCollisions(ray,{blockMovement:true, blockSenses:false, mode:"any"});
		else return true;
	}
	
	rebuildGrid()
	{
		for (let x = 0;x<(canvas.grid._width/canvas.grid.size);x++)
		{
			this.grid[x] = [];
			for (let y = 0;y<(canvas.grid._height/canvas.grid.size);y++)
			{
				this.grid[x][y]={};
				this.grid[x][y].x=x;
				this.grid[x][y].y=y;
				this.grid[x][y].f=0;
				this.grid[x][y].g=0;
				this.grid[x][y].h=0;
				this.grid[x][y].parent=null;
			}
		}
	}
	
	findPath()
	{
		this.rebuildGrid();
		let endpoint = {x:this.endpoint[0],y:this.endpoint[1]};
		let openList = [];
		let closedList = [];
		openList.push(this.grid[this.origin[0]][this.origin[1]]);
		
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
				this.removeRuler();
				return;
			}
			if (currentNode.x=== endpoint.x && currentNode.y === endpoint.y)
			{
				let curr = currentNode;
				let ret = [];
				while(curr.parent)
				{
					let loc = [curr.x, curr.y];
					loc = this.convertGridspaceToLocation(loc);
					let point = new PIXI.Point(loc.x,loc.y);
					ret.push(point);
					curr = curr.parent;
				}
				this.waypoints = [];
				origin = this.convertGridspaceToLocation(this.origin);
				this.waypoints.push(new PIXI.Point(origin.x,origin.y));
				for (let i=ret.length-1;i>0;i--)
					this.waypoints.push(ret[i]);
				this.drawRuler();
				return;
			}
			openList.splice(lowIndex,1);
			closedList.push(currentNode);
			
			let neighbors = this.getNeighbors(currentNode);
			for(let i=0;i<neighbors.length;i++)
			{
				let neighbor = neighbors[i];
				if (this.isInList(closedList,neighbor) || this.hitsWall(currentNode,neighbor))
					continue;
				
				let gScore = 0;
				if (currentNode.x === neighbor.x || currentNode.y === neighbor.y)
					gScore = currentNode.g + 1;
				else gScore = currentNode.g + 1.5;
				let gScoreIsBest = false;
				
				if (!this.isInList(openList,neighbor))
				{
					gScoreIsBest = true;
					neighbor.h = this.heuristic(neighbor,endpoint)
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
		this.removeRuler();
	}
	
	isInList(list, node)
	{
		for (let i=0; i<list.length; i++)
		{
			if (list[i].x === node.x && list[i].y === node.y)
				return true;
		}
		return false;
	}
	
	isValidNode(node)
	{
		return (node.y >= 0 && node.y < (canvas.grid._height/canvas.grid.size) && node.x >= 0 && node.x < (canvas.grid._width/canvas.grid.size));
	}
	
	getNeighbors(node)
	{
		let neighbors = [];
		let x = node.x;
		let y = node.y;
		for (let i=-1; i<2; i++)
		{
			for (let j=-1;j<2;j++)
			{
				if (!(i===0 && j===0)&&this.isValidNode({x:x+i,y:y+j}))
					neighbors.push(this.grid[x+i][y+j]);
			}
		}
		return neighbors;
	}
	
	heuristic(start,end)
	{
		let xdistance = Math.abs(start.x-end.x);
		let ydistance = Math.abs(start.y-end.y);
		if (xdistance>ydistance) return (xdistance+(ydistance/2));
		else return (ydistance+(xdistance/2));
	}
}


Hooks.on("init", () => {
	const pathfindingRuler = new PathfindingRuler();
});
