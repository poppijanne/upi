/* global generateTimestamp, uuid, logger, app, UpiError, moment */
/* exported CloudantEntity, resourceService, Dates */

const Dates = {
    countDaysToDate: function (date) {
        if (date !== undefined) {
            return moment().diff(date, 'days') * -1;
        }
    }
}

class Logger {

    log(message) {
        console.log(message);
    }

    logError(message, error) {

        console.error(message);

        if (error !== undefined) {
            console.error(error);
        }
    }
}

var logger = new Logger();

class CloudantEntity {
    constructor(props) {
        this._id = props._id || uuid();
        this._rev = props._rev;
        this._deleted = props._deleted;
        if (props._rev === undefined) {
            this.created = generateTimestamp();
        } else {
            this.created = props.created;
        }
    }

    get isNew() {
        return this.rev !== undefined;
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get rev() {
        return this._rev;
    }

    set rev(rev) {
        this._rev = rev;
    }

    get deleted() {
        return this._deleted;
    }

    set deleted(deleted) {
        this._deleted = deleted;
    }
}

class ValidationError {
    constructor(props = {}) {
        this.type = props.type !== undefined ? props.type : "ERROR";
        this.field = props.field;
        this.message = props.message;
    }
}

class ValidationResult {
    constructor(props = { ok: true, errors: [] }) {
        this.ok = props.ok;
        this.errors = props.errors.map(error => new ValidationError(error));
    }

    doesFieldHaveErrors(field) {
        return this.getFieldErrors(field).length > 0;
    }

    getFieldErrors(field) {
        return this.errors.filter(error => error.field === field);
    }
}

class Store {

    constructor(items = [], name = "Store") {
        this.name = name;
        this.items = items;
    }

    hasItems() {
        return this.items.length > 0;
    }

    getWithId(id) {
        let item = this.items.find(item => item._id === id);
        if (item === undefined) {
            logger.log(`Could not get item from ${this.name} with id: Item ${id} not found`);
            return { notFound: true, _id: id, name: "?" };
        }
        return item;
    }

    add(itemToAdd) {

        let index = this.items.findIndex(item => item._id === itemToAdd._id);
        if (index !== -1) {
            // can't use [i] because of Vue's change detection 
            this.items.splice(index, 1, itemToAdd);
        } else {
            this.items.push(itemToAdd);
        }
    }

    addAll(items) {
        items.forEach(item => this.add(item));
    }

    remove(itemToRemove) {
        let index = this.items.findIndex(item => item._id === itemToRemove._id);
        if (index !== -1) {
            this.items.splice(index, 1);
        } else {
            logger.log(`Unable to delete item from ${this.name}: Item ${itemToRemove._id} not found`);
        }
    }

    removeAll(items) {
        items.forEach(item => this.remove(item));
    }

    getIds() {
        return this.items.map(item => item._id);
    }
}

class ResourceService {
    constructor(props = {}) {
        this.host = props.host !== undefined ? props.host : `${window.location.protocol}//${window.location.host}`;
        this.cache = [];
    }

    async load(resource) {
        if (app !== undefined) app.loaders++;

        let response;
        try {
            response = await fetch(this.host + "/" + resource);
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let json;
        try {
            json = await response.json();
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        if (app !== undefined && app.loaders > 0) app.loaders--;
        if (json.isError === true) {
            logger.logError(`Loading resource from ${resource} failed.`, json);
            throw new UpiError(json);
        }
        //let items = json.map(row => row.doc);
        return json;
    }

    async loadAll(resource) {
        if (app !== undefined) app.loaders++;
        let response;
        try {
            response = await fetch(this.host + "/" + resource);
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let json = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;
        if (json.isError === true) {
            logger.logError(`Loading resources from ${resource} failed.`, json);
            throw new UpiError(json);
        }
        let items = json.map(row => row.doc);
        return items;
    }

    async loadAllWithIndex(resource) {
        if (app !== undefined) app.loaders++;

        let response;
        try {
            response = await fetch(this.host + "/" + resource);
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let json = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;
        if (json.isError === true) {
            logger.logError(`Loading resources from ${resource} failed.`, json);
            throw new UpiError(json);
        }
        return json;
    }

    async saveItemToResource(item, resource) {
        if (app !== undefined) app.loaders++;

        let response;
        try {
            response = await fetch(this.host + "/" + resource, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: "POST",
                credentials: 'same-origin',
                body: JSON.stringify(item)
            });
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let result = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;
        if (result.isError === true) {
            logger.logError(`Saving item ${item._id} to ${resource} failed.`, result);
            throw new UpiError(result);
        }
        logger.log(result);

        if (result.ok === true) {
            item._id = result.id;
            item._rev = result.rev;
        }

        return item;
    }

    async saveItemsToResource(items, resource) {
        if (app !== undefined) app.loaders++;
        let response;
        try {
            response = await fetch(this.host + "/" + resource, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: "POST",
                credentials: 'same-origin',
                body: JSON.stringify(items)
            });
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let result = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;
        logger.log(result);

        if (result.isError === true) {
            logger.logError(`Saving items to ${resource} failed.`, result);
            throw new UpiError(result);
        } else {
            for (let i = 0; i < items.length; i++) {
                items[i]._rev = result[i].rev;
            }
        }

        items = items.filter(item => item._deleted);

        return items;
    }

    async deleteItemFromResource(item, resource) {
        if (app !== undefined) app.loaders++;

        let response;
        try {
            response = await fetch(this.host + "/" + resource, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: "DELETE",
                credentials: 'same-origin',
                body: JSON.stringify(item)
            });
        }
        catch (e) {
            app.loaders--;
            throw new UpiError(e);
        }

        let result = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;
        if (result.isError === true) {
            logger.logError(`Deleting item ${item._id} from ${resource} failed.`, result);
            throw new UpiError(result);
        }

        return item;
    }

    async validateItem(item, type) {
        if (app !== undefined) app.loaders++;
        let response = await fetch(this.host + "/validate/" + type, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify(item)
        });

        let result = await response.json();
        if (app !== undefined && app.loaders > 0) app.loaders--;

        logger.log(result);

        return new ValidationResult(result);
    }
}

var resourceService = new ResourceService();