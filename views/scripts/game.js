/* global Player, CloudantEntity, Store, resourceService, moment */
/* exported gameService */

class Game extends CloudantEntity {
    constructor(props = { player1Goals: 0, player2Goals: 0, overtime: false, isPlayed: false }) {
        super(props);
        this.created = props.created !== undefined ? props.created : moment().format("YYYY-MM-DD");
        this.leagueId = props.leagueId;
        this.seasonId = props.seasonId;
        this.roundId = props.roundId;
        this.player1Id = props.player1Id;
        this.player2Id = props.player2Id;
        this.player1Goals = parseInt(props.player1Goals);
        this.player2Goals = parseInt(props.player2Goals);
        this.location = props.location;
        this.date = props.date;
        this.isPlayed = props.isPlayed;
        this.overtime = props.overtime;
        this.comments = props.comments;
        this.offScoreboard = props.offScoreboard || false;
    }

    get dateAsDate() {
        if (this.date !== undefined) {
            return new Date(this.date);
        }
        return new Date();
    }

    set dateAsDate(date) {
        if (date !== undefined) {
            this.date = date.toISOString().split("T")[0];
        }
        else {
            this.date = undefined;
        }
    }

    hasPlayerId(playerId) {
        return this.player1Id === playerId || this.player2Id === playerId;
    }

    getOpponentId(playerId) {
        if (this.player1Id === playerId) {
            return this.player2Id;
        }
        return this.player1Id;
    }

    getPlayerScore(playerId) {
        if (this.didPlayerLose(playerId) && !this.overtime) {
            return 0;
        }
        if (this.didPlayerWin(playerId)) {
            return 2;
        } else if (this.overtime) {
            return 1;
        }
        return 0;
    }

    didPlayerWin(playerId) {
        if (this.getPlayerGoals(playerId) > this.getOpponentGoals(playerId)) {
            return true;
        }
    }

    didPlayerLose(playerId) {
        if (this.getPlayerGoals(playerId) < this.getOpponentGoals(playerId)) {
            return true;
        }
    }

    getPlayerGoals(playerId) {
        if (this.player1Id === playerId) {
            return this.player1Goals;
        }
        if (this.player2Id === playerId) {
            return this.player2Goals;
        }
    }

    getOpponentGoals(playerId) {
        if (this.player2Id === playerId) {
            return this.player1Goals;
        }
        if (this.player1Id === playerId) {
            return this.player2Goals;
        }
    }

    getWinnerId() {
        return this.player1Goals > this.player2Goals ? this.player1Id : this.player2Id;
    }

    getLoserId() {
        return this.player1Goals < this.player2Goals ? this.player1Id : this.player2Id;
    }    

    getWinnerGoals() {
        return this.player1Goals > this.player2Goals ? this.player1Goals : this.player2Goals;
    }

    getLoserGoals() {
        return this.player1Goals < this.player2Goals ? this.player1Goals : this.player2Goals;
    }  

    bothPlayersAreSet() {
        return this.player1Id !== undefined && this.player2Id !== undefined;
    }

    swapPlayersAndResults() {
        let player1Goals = this.player1Goals;
        let player1Id = this.player1Id;
        this.player1Goals = this.player2Goals;
        this.player2Goals = player1Goals;
        this.player1Id = this.player2Id;
        this.player2Id = player1Id;
    }
}

class GameStore extends Store {

    constructor(items, name = "GameStore") {
        super(items, name);
    }

    get games() {
        return this.items;
    }

    set games(games) {
        this.items = games;
    }

    getSeasonStatisticsForPlayers(seasonId, playerIds) {
        let playerStats = [];
        playerIds.forEach(playerId => playerStats.push(this.getSinglePlayerStatistics(seasonId, playerId)));
        playerStats = playerStats.sort((stats1, stats2) => {
            
            if (stats1.score !== stats2.score) {
                return stats2.score - stats1.score;
            }

            let mutualGamesDifference = this.comparePlayers(stats1.playerId, stats2.playerId);
            console.log(mutualGamesDifference);
            if (mutualGamesDifference !== 0) {
                return mutualGamesDifference;
            }

            if (stats1.playedGames !== stats2.playedGames) {
                return stats1.played - stats2.played;
            }

            if (stats1.wins !== stats2.wins) {
                return stats2.wins - stats1.wins;
            }

            if (stats1.goals !== stats2.goals) {
                return stats2.goals - stats1.goals;
            }            

            return 0;
        });
        return playerStats;
    }

    getStatistics(games) {

        let stats = {
            playedGames: 0,
            unplayedGames: 0,
            wins: 0,
            loses: 0,
            ties: 0,
            overtimes: 0,
            goals: 0,
            games: games.length
        };

        games.forEach(game => {
            if (!game.offScoreboard) {
                if (game.isPlayed) {
                    stats.playedGames++;
                    stats.goals += game.player1Goals + game.player2Goals;
                    if (game.player1Goals === game.player2Goals) {
                        stats.ties++;
                    } else {
                        stats.wins++;
                    }
                    if (game.overtime === true) {
                        stats.overtimes++;
                    }
                } else {
                    stats.unplayedGames++;
                }
            }
        });

        return stats;
    }

    getSinglePlayerStatistics(seasonId, playerId) {
        let stats = {
            playerId: playerId,
            seasonId: seasonId,
            games: 0,
            played: 0,
            unplayed: 0,
            goals: 0,
            opponentGoals: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            overtimes: 0,
            score: 0
        };

        this.games.forEach(game => {
            if (!game.notFound && !game.offScoreboard && game.hasPlayerId !== undefined && game.hasPlayerId(playerId) && game.seasonId === seasonId) {
                stats.games++;
                if (game.isPlayed) {
                    stats.played++;
                    stats.goals += game.getPlayerGoals(playerId);
                    stats.opponentGoals += game.getOpponentGoals(playerId);

                    if (game.didPlayerWin(playerId)) {
                        stats.wins++;
                    } else if (game.didPlayerLose(playerId)) {
                        stats.losses++;
                    }

                    if (game.overtime) {
                        stats.overtimes++;
                    }

                    if (game.player1Goals === game.player2Goals) {
                        stats.ties++;
                    }

                    stats.score += game.getPlayerScore(playerId);
                }
            }
        });
        stats.unplayed = stats.games - stats.played;

        return stats;
    }

    getGamesOfPlayer(playerId) {
        return this.games.filter(game => game.hasPlayerId(playerId));
    }

    getPlayedGamesOfPlayer(playerId) {
        return this.getGamesOfPlayer(playerId).filter(game => game.isPlayed);
    }

    getUnplayedGamesOfPlayer(playerId) {
        return this.getGamesOfPlayer(playerId).filter(game => !game.isPlayed);
    }

    doesPlayerHaveGamesInSeason(playerId, seasonId) {
        return this.games.filter(game => game.seasonId === seasonId && game.hasPlayerId(playerId)).length > 0;
    }

    getGamesOfSeason(seasonId) {
        return this.games.filter(game => game.seasonId === seasonId);
    }

    getGamesOfRound(roundId) {
        return this.games.filter(game => game.roundId === roundId);
    }

    getUnplayedGamesOfRound(roundId) {
        let games = this.getGamesOfRound(roundId);
        return games.filter(game => !game.isPlayed);
    }

    comparePlayers(player1Id, player2Id) {
        let games = this.games.filter(game => !game.offScoreboard && game.hasPlayerId(player1Id) && game.hasPlayerId(player2Id));
        let player1Wins = 0;
        let player2Wins = 0;
        games.forEach(game => {
            if (game.didPlayerWin(player1Id)) {
                player1Wins++;
            }
            if (game.didPlayerWin(player2Id)) {
                player2Wins++;
            }            
        });
        return player2Wins - player1Wins;
    }
}

var gameCache = new GameStore([], "GameCache");

class GameService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadGames() {
        let results = await this.resourceService.loadAll("games");
        let games = results.map(game => { return new Game(game) });
        gameCache.addAll(games);
        return games;
    }

    async loadGame(id) {
        let result = await this.resourceService.load(`game/${id}`);
        gameCache.add(new Game(result));
        return new Game(result);
    }

    async loadGamesInSeason(seasonId) {
        let results = await this.resourceService.loadAllWithIndex(`season/${seasonId}/games`);
        let games = results.map(game => { return new Game(game) });
        gameCache.addAll(games);
        return games;
    }

    async loadGamesOfPlayer(player) {
        let results = await this.resourceService.loadAllWithIndex(`player/${player.id}/games`);
        let games = results.map(game => { return new Game(game) });
        gameCache.addAll(games);
        return games;
    }

    async deleteGame(game) {
        game = await this.resourceService.deleteItemFromResource(game, "games");
        return game;
    }

    async saveGame(game) {
        game = await this.resourceService.saveItemToResource(game, "games");
        return game;
    }

    async saveGames(games) {
        games = await this.resourceService.saveItemsToResource(games, "games/all");
        return games;
    }
}

class GameReporter {

    report(game, round, player1, player2) {
        
        if (game.player1Goals === game.player2Goals) {
            return `Peli ${player1.label} vs ${player2.label} päättyi tasapeliin ${game.player1Goals} - ${game.player2Goals} (${round.name})`;
        }
        let winner = game.getWinnerId() === player1.id ? player1 : player2;
        let loser = game.getLoserId() === player1.id ? player1 : player2;
        return `Peli ${winner.label} vs ${loser.label} päättyi tulokseen ${game.getWinnerGoals()} - ${game.getLoserGoals()}${game.overtime ? ' jatkoajalla' : ''} (${round.name})`;
    }
}

var gameService = new GameService({
    resourceService: resourceService
});

if (typeof module !== "undefined") {
    module.exports.GameReporter = GameReporter; 
    module.exports.Game = Game;
}