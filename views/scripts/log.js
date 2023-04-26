/* global CloudantEntity, Store, resourceService */
/* exported LogService, logService */

const LogTypes = {
    REPORT: "REPORT"
}

class Log extends CloudantEntity {
    constructor(props = {}) {
        super(props);
        this.type = props.type || LogTypes.REPORT;
        this.organizationId = props.organizationId;
        this.playerId = props.playerId;
        this.seasonId = props.seasonId;
        this.gameId = props.gameId;
        this.leagueId = props.leagueId;
        this.roundId = props.roundId;
        this.trophyId = props.trophyId;
        this.text = props.text;
        this.timestamp = props.timestamp || new Date().toISOString();
    }

    get date() {
        return this.created.split(' ')[0]; 
    }
}

class LogStore extends Store {
    constructor(items, name = "LogStore") {
        super(items, name);
    }

    get logs() {
        return this.items;
    }

    set logs(logs) {
        this.items = logs;
    }
}

var logCache = new LogStore([], "LogCache");

class LogService {

    constructor(props) {
        this.resourceService = props.resourceService;
    }

    async loadLog(id) {
        let result = await this.resourceService.load(`log/${id}`);
        logCache.add(new Log(result));
        return new Log(result);
    }

    async loadLogsOfOrganization(organizationId) {
        let results = await this.resourceService.loadAllWithIndex(`organization/${organizationId}/logs`);
        let logs = results.map(log => { return new Log(log) });
        logCache.addAll(logs);
        return logs;
    }

    async loadLogsOfSeason(seasonId) {
        let results = await this.resourceService.loadAllWithIndex(`season/${seasonId}/logs`);
        let logs = results.map(log => { return new Log(log) });
        logCache.addAll(logs);
        return logs;
    }

    async saveLog(log) {
        log = await this.resourceService.saveItemToResource(log, "log");
        return log;
    }

    async deleteLog(log) {
        log = await this.resourceService.deleteItemFromResource(log, "log");
        return log;
    }   
}

var logService = new LogService({
    resourceService: resourceService
});