const assert = require("assert");
let { Player } = require("../views/scripts/player.js");
let { Game, GameReporter } = require("../views/scripts/game.js");

exports.testReporter = () => {
    let player1 = new Player({
        id: "xxx"
    });
    let player2 = new Player({
        id: "yyy"
    });
    let game = new Game({
        player1Id: player1.id,
        player2Id: player2.id,
        player1Goals: 1,
        player2Goals: 2
    });

    let reporter = new GameReporter();
    let report = reporter.report(game, player1, player2);
    console.log(report);
};