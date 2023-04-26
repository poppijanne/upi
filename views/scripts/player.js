/* global window, CloudantEntity, Store, resourceService */
/* exported playerService */
/*
if (typeof module !== "undefined") {
    this.CloudantEntity = require("./common.js").CloudantEntity; 
}

if (typeof window === "undefined") {
    window = {}
}
*/
class Player extends CloudantEntity {
    constructor(props = { active: true, number: 0 }) {
        super(props);
        this.alias = props.alias;
        this.number = parseInt(props.number);
        this.name = props.name;
        this.email = props.email;
        this.location = props.location;
        this.organizationId = props.organizationId;
        this.active = props.active;
    }

    get label() {
        return this.alias !== undefined && this.alias !== "" ? this.alias : this.name;
    }
}

class PlayerStore extends Store {

    constructor(items, name = "PlayerStore") {
        super(items, name);
        this.playerIdOfUser = undefined;
    }

    get players() {
        return this.items;
    }

    set players(players) {
        this.items = players;
    }

    isPlayerIdActive(id) {
        return this.players.find(player => player.id === id && player.active) !== undefined;
    }

    getPlayerLabelWithId(id) {
        let player = this.players.find(player => player.id === id);
        return player.label;
    }

    getPlayersOfOrganization(organizationId) {
        return this.players.filter(player => player.organizationId === organizationId);
    }
}

var playerCache = new PlayerStore([], "PlayerCache");

class PlayerService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadPlayers() {
        if (playerCache.players.length > 0) {
            return playerCache.players;
        }
        let results = await this.resourceService.loadAll("players");
        let players = results.map(player => { return new Player(player) });
        playerCache.addAll(players);
        return players;
    }

    async loadPlayer(id, updateCache = true) {
        let player = playerCache.getWithId(id);
        if (player.notFound) {
            let result = await this.resourceService.load(`player/${id}`);
            if (updateCache) {
                playerCache.add(new Player(result));
            }
            return new Player(result);
        }
        return new Player(player);
    }

    async deletePlayer(player) {
        player = await this.resourceService.deleteItemFromResource(player, "players");
        playerCache.remove(player);
        return player;
    }

    async savePlayer(player) {
        player = await this.resourceService.saveItemToResource(player, "players");
        playerCache.add(new Player(player));
        return player;
    }

    async loadAllPlayersInOrganization(organizationId) {
        let playersOfOrganization = playerCache.getPlayersOfOrganization(organizationId);
        if (playersOfOrganization.length > 0) {
            return playersOfOrganization;
        }
        let results = await this.resourceService.loadAllWithIndex(`organization/${organizationId}/players`);
        let players = results.map(player => { return new Player(player) });
        players = players.sort((player1, player2) => player1.label.localeCompare(player2.label));
        playerCache.addAll(players);
        return players;
    }

    async validatePlayer(player) {
        return this.resourceService.validateItem(player, "player");
    }
}

var playerService = new PlayerService({
    resourceService: resourceService
});

if (typeof module !== "undefined") {
    module.exports.Player = Player; 
}