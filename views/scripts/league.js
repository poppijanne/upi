/* global CloudantEntity, Store, resourceService, logger, uuid */
/* exported OrganizationService, organizationService, leagueService */

class League extends CloudantEntity {
    constructor(props = {}) {
        super(props);
        this.name = props.name;
        this.organizationId = props.organizationId;
        this.seasons = props.seasons !== undefined ? props.seasons.map(season => new Season(season)) : [];
    }

    getSeasonWithId(id) {
        return this.seasons.find(season => season.id === id);
    }

    addSeason(season) {
        this.seasons.push(season);
    }

    removeSeason(seasonToRemove) {
        let index = this.seasons.findIndex(season => season.id === seasonToRemove.id);
        if (index !== -1) {
            this.seasons.splice(index, 1);
        } else {
            logger.log(`Unable to delete season from league: Season ${seasonToRemove.id} not found`);
        }
    }

    hasPlayerId(id) {
        return this.seasons.find(season => season.hasPlayerId(id)) !== undefined;
    }
}

class Season {
    constructor(props = { closed: false, name: "" + new Date().getFullYear() }) {
        this._id = props._id !== undefined ? props._id : uuid();
        this.name = props.name;
        this.closed = props.closed;
        this.divisions = props.divisions !== undefined ? props.divisions.map(division => new Division(division)) : [];
        this.rounds = props.rounds !== undefined ? props.rounds.map(round => new Round(round)) : [];
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    getDivisionWithId(id) {
        return this.divisions.find(division => division._id === id);
    }

    removeDisivion(divisionToRemove) {
        this.divisions = this.divisions.filter(division => division._id !== divisionToRemove._id);
    }

    getPlayerIdsInDivisions() {
        let playerIds = [];
        this.divisions.forEach(division => {
            division.playerIds.forEach(playerId => {
                playerIds.push(playerId);
            });
        });
        return playerIds;
    }

    getPlayerIdsInOtherDivisions(thisDivision) {
        let playerIds = [];
        this.divisions.forEach(division => {
            if (thisDivision._id !== division._id) {
                division.playerIds.forEach(playerId => {
                    playerIds.push(playerId);
                });
            }
        });
        return playerIds;
    }

    getRoundWithId(id) {
        return this.rounds.find(round => round._id === id);
    }

    removeRound(roundToRemove) {
        this.rounds = this.rounds.filter(round => round._id !== roundToRemove._id);
    }

    hasPlayerId(id) {
        return this.divisions.find(division => division.hasPlayerId(id)) !== undefined;
    }

    getPlayersDivision(playerId) {
        return this.divisions.find(division => division.hasPlayerId(playerId));
    }
}

class Division {
    constructor(props = { level: 1 }) {
        this._id = props._id || uuid();
        this.level = parseInt(props.level);
        this.name = props.name;
        this.playerIds = props.playerIds || [];
        this.promotionLimits = props.promotionLimits || [];
        this.demotionLimits = props.demotionLimits || [];
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    hasPlayerId(id) {
        return this.playerIds.find(playerId => playerId === id) !== undefined;
    }

    isPromotionLimit(index) {
        return this.promotionLimits.find(limit => limit.limit === index) !== undefined;
    }

    isDemotionLimit(index) {
        return this.demotionLimits.find(limit => limit.limit === index) !== undefined;
    }
}

class Round {
    constructor(props = { order: 1 }) {
        this._id = props._id !== undefined ? props._id : uuid();
        this.name = props.name;
        this.order = parseInt(props.order);
        this.showResultsDate = props.showResultsDate;
        this.deadline = props.deadline;
        if (isNaN(this.order)) {
            this.order = 1;
        }
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get deadlineAsDate() {
        if (this.deadline !== undefined) {
            return new Date(this.deadline);
        }
        return new Date();
    }

    set deadlineAsDate(deadline) {
        if (deadline !== undefined) {
            this.deadline = deadline.toISOString().split("T")[0];
        }
        else {
            this.deadline = undefined;
        }
    }

    get showResultsDateAsDate() {
        if (this.showResultsDate !== undefined) {
            return new Date(this.showResultsDate);
        }
        return new Date();
    }

    set showResultsDateAsDate(showResultsDate) {
        if (showResultsDate !== undefined) {
            this.showResultsDate = showResultsDate.toISOString().split("T")[0];
        }
        else {
            this.showResultsDate = undefined;
        }
    }  
    
    get showResults() {
        return this.showResultsDate === undefined || (new Date().getTime() - this.showResultsDateAsDate.getTime() > 0);
    }
}

class LeagueStore extends Store {
    constructor(items, name = "LeagueStore") {
        super(items, name);
    }

    get leagues() {
        return this.items;
    }

    set leagues(leagues) {
        this.items = leagues;
    }

    getSeasonWithId(seasonId) {
        let season;
        this.leagues.forEach(league => {
            season = league.seasons.find(season => {
                return season.id === seasonId;
            });
        });
        return season;
    }

    getRoundWithId(roundId) {
        let round;
        this.leagues.forEach(league => {
            league.seasons.forEach(season => {
                if (round === undefined) {
                    round = season.rounds.find(round => {
                        return round.id === roundId;
                    });
                }
            });
        });
        return round;
    }

    getLeaguesOfOrganization(organization) {
        return this.leagues.filter(league => league.organizationId === organization.id);
    }
}

var leagueCache = new LeagueStore([], "LeagueCache");

class LeagueService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadLeagues() {
        let results = await this.resourceService.loadAll("leagues");
        let leagues = results.map(league => { return new League(league) });
        leagues = leagues.sort((league1, league2) => {
            return league1.name.localCompare(league2.name)
        });
        leagueCache.addAll(leagues);
        return leagues;
    }

    async loadLeague(id) {
        let result = await this.resourceService.load(`league/${id}`);
        leagueCache.add(new League(result));
        return new League(result);
    }

    async deleteLeague(league) {
        league = await this.resourceService.deleteItemFromResource(league, "leagues");
        return league;
    }

    async saveLeague(league) {
        league = await this.resourceService.saveItemToResource(league, "leagues");
        return league;
    }

    async loadAllLeaguesInOrganization(organizationId) {
        let results = await this.resourceService.loadAllWithIndex(`organization/${organizationId}/leagues`);
        let leagues = results.map(league => { return new League(league) });
        leagues.forEach(league => {
            league.seasons.sort((season1, season2) => {
                return season1.name.localeCompare(season2.name);
            });
        });
        leagueCache.addAll(leagues);
        return leagues;
    }

    async validateLeague(league) {
        return this.resourceService.validateItem(league, "league");
    }
}

var leagueService = new LeagueService({
    resourceService: resourceService
});