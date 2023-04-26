/* global CloudantEntity, Store, resourceService */
/* exported OrganizationService, organizationService, trophyService, trophyTypes */

const trophyTypes = {
    TROPHY: "TROPHY",
    AWARD: "AWARD"
};

class Trophy extends CloudantEntity {
    constructor(props = { type: trophyTypes.TROPHY, rank: 1 }) {
        super(props);
        this.playerId = props.playerId;
        this.leagueId = props.leagueId;
        this.seasonId = props.seasonId;
        this.name = props.name;
        this.type = props.type;
        this.year = props.year;
        this.rank = props.rank || 1;
    }

    compare(trophy2) {
        if (this.type === trophyTypes.TROPHY && trophy2.type === trophyTypes.AWARD) {
            return 1;
        }
        else if (trophy2.type === trophyTypes.TROPHY && this.type === trophyTypes.AWARD) {
            return -1;
        }
        return trophy2.rank - this.rank;
    }
}

class TrophyStore extends Store {
    constructor(items, name = "TrophyStore") {
        super(items, name);
    }

    get trophies() {
        return this.items;
    }

    set trophies(trophies) {
        this.items = trophies;
    }

    getTrophiesInSeason(seasonId) {
        return this.trophies.filter(trophy => trophy.seasonId === seasonId);
    }

    getTrophiesOfPlayer(playerId) {
        return this.trophies.filter(trophy => trophy.playerId === playerId);
    }    
}

var trophyCache = new TrophyStore([], "TrophyCache");

class TrophyService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadTrophy(id) {
        let trophy = trophyCache.getWithId(id);
        if (trophy.notFound) {
            let result = await this.resourceService.load(`trophy/${id}`);
            trophyCache.add(new Trophy(result));
            return new Trophy(result);
        }
        return new Trophy(trophy);
    }

    async loadTrophiesInSeason(seasonId) {
        let results = await this.resourceService.loadAllWithIndex(`season/${seasonId}/trophies`);
        let trophies = results.map(trophy => { return new Trophy(trophy) });
        trophyCache.addAll(trophies);
        return trophies;
    }

    async loadTrophiesOfPlayer(player) {
        let results = await this.resourceService.loadAllWithIndex(`player/${player.id}/trophies`);
        let trophies = results.map(trophy => { return new Trophy(trophy) });
        trophyCache.addAll(trophies);
        return trophies;
    }

    async saveTrophy(trophy) {
        trophy = await this.resourceService.saveItemToResource(trophy, "trophy");
        trophyCache.add(new Trophy(trophy));
        return trophy;
    }

    async deleteTrophy(trophy) {
        trophy = await this.resourceService.deleteItemFromResource(trophy, "trophy");
        trophyCache.remove(trophy);
        return trophy;
    }

    async validateTrophy(trophy) {
        return this.resourceService.validateItem(trophy, "trophy");
    }
}

var trophyService = new TrophyService({
    resourceService: resourceService
});