/*	Copyright (C) 2020 John Haverkamp
* 
*   This program is free software: you can redistribute it and/or modify
*   it under the terms of the GNU Affero General Public License as published
*   by the Free Software Foundation, either version 3 of the License, or
*   (at your option) any later version.
*
*   This program is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU Affero General Public License for more details.
*
*   You should have received a copy of the GNU Affero General Public License
*   along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
"use strict"

class Config {
	constructor()
	{/* to support planned features
		game.settings.register("grid-pathfinder", "pathfinderDiagonals",
		{
			name: game.i18n.localize("grid-pathfinder.pathfinderDiagonals.name"),
			hint: game.i18n.localize("grid-pathfinder.pathfinderDiagonals.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		});
	
		game.settings.register("grid-pathfinder", "printMoveToChat",
		{
			name: game.i18n.localize("grid-pathfinder.printMoveToChat.name"),
			hint: game.i18n.localize("grid-pathfinder.printMoveToChat.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		});*/
	}
}

class PathFinder {
	constructor()
	{
		this.config = new Config();
		
		Hooks.on("getSceneControlButtons", (buttons) => {
			let tokenButton = buttons.find((button) => button.name === "token");
			if (tokenButton)
			{
				tokenButton.tools.push(
				{
					name: "grid-pathfinder",
					title: game.i18n.localize("grid-pathfinder.toolname"),
					layer: "TokenLayer",
					icon: "fas fa-route",
					visible: true,
				});
			}
		});

		Hooks.on("canvasReady", () => {
//			if (game.activeTool === "grid-pathfinder")
//			{
				canvas.stage.on("mousedown", (event) => this.mousedownListener(event));
				canvas.stage.on("mouseup", (event) => this.mouseupListener(event));
				canvas.stage.on("mousemove", (event) => this.mousemoveListener(event));
//			}
		});
	}
	
	mousedownListener(event)
	{
		if (game.activeTool === "grid-pathfinder")
		{
			let chatData = {
				user: game.user._id,
				speaker: ChatMessage.getSpeaker(),
				content: "I'm winning the mouse!",
				type: CONST.CHAT_MESSAGE_TYPES.IC,
			}

			ChatMessage.create(chatData, {chatBubble : true })
		}
	}
	
	mouseupListener(event)
	{
		if (game.activeTool === "grid-pathfinder")
		{
			let chatData = {
				user: game.user._id,
				speaker: ChatMessage.getSpeaker(),
				content: "I'm losing the mouse!",
				type: CONST.CHAT_MESSAGE_TYPES.IC,
			}

			ChatMessage.create(chatData, {chatBubble : true })
		}
	}
	
	mousemoveListener(event)
	{

	}
}

Hooks.on("init", () => {
	const pathFinder = new PathFinder();
});
