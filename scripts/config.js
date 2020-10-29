class Config {
  constructor() {
    game.settings.register("grid-pathfinder", "pathfinderDiagonals", {
      name: game.i18n.localize("grid-pathfinder.pathfinderDiagonals.name"),
      hint: game.i18n.localize("grid-pathfinder.pathfinderDiagonals.hint"),
      scope: "world",
      config: true,
      default: true,
      type: Boolean,
    });

    game.settings.register("grid-pathfinder", "printMoveToChat", {
      name: game.i18n.localize("grid-pathfinder.printMoveToChat.name"),
      hint: game.i18n.localize("grid-pathfinder.printMoveToChat.hint"),
      scope: "world",
      config: true,
      default: true,
      type: Boolean,
    });
  }
}

export default Config;
