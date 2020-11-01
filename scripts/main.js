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
						this.removeRuler();
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
			gridspace[0] = (gridspace[0] / canvas.grid.size) + .5;
			gridspace[1] = (gridspace[1] / canvas.grid.size) + .5;
			return gridspace;
	}
	
	convertGridspaceToLocation(gridspace)
	{
			let location = {x: gridspace[0], y: gridspace[1]};
			location.x = (location.x - .5 ) * canvas.grid.size;
			location.y = (location.y - .5 ) * canvas.grid.size;
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
	
	hitsWall(origin, endpoint)
	{
		let ray = new Ray(this.convertGridspaceToLocation(this.origin),this.convertGridspaceToLocation(this.endpoint));
		return WallsLayer.getRayCollisions(ray,{blockMovement:true, blockSenses:false, mode:"any"});
	}
	
	async findPath()
	{
		let openList = [];
		let closedList = [];
		openList.push({x:this.origin.x,y:this.origin.y,g:0,h:h(this.origin,this.endpoint),f:h(this.origin,this.endpoint)});
		
		while (openList.length > 0)
		{
			let lowIndex = 0;
			for (let i=0; i<openList.length; i++)
			{
				if (openList[i].f < openList[lowInd].f) {lowIndex = i}
			}
			let currentNode = openList[lowIndex];
			if ({x:currentNode.x,y:currentNode.y} === this.endpoint})
			{
				let curr = currentNode;
				let ret = [];
				while(curr.parent)
				{
					ret.push({x:curr.x,y:curr.y});
					curr = curr.parent;
				}
				this.waypoints = ret;
				drawRuler();
				return;
			}
			openList.splice(lowIndex,1);
			closedList.push(currentNode);
			
			let neighbors = [];
			
			for (let i=-1; i<2; i++)
			{
				for (let j=-1;j<2;j++)
				{
					if (!(i===0 && j===0)
						neighbors.push({x:(currentNode.x+i),y:(currentNode.y+j),f:,g:,h:});
				}
			}
			
			for(let i=0;i<neighbors.length;i++)
			{
				let neighbor = neighbors[i];
				
			}
			
		}
		this.drawRuler();
	}
	
	isValidNode(node)
	{
		
		return true;
	}

	h(start,end)
	{
		let xdistance = Math.abs(start.x-end.x);
		let ydistance = Math.abs(start.x-end.x);
		if (xdistance>ydistance) return (xdistance+(ydistance/2));
		else return (ydistance+(xdistance/2);
	}
}


Hooks.on("init", () => {
	const pathfindingRuler = new PathfindingRuler();
});
