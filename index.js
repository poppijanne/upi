// https://github.com/cloudant-labs/cloudant-nano#database-functions
// https://github.com/cloudant/nodejs-cloudant
// https://www.npmjs.com/package/cloudant-nano
// https://github.com/expressjs/compression
const compression = require('compression');
const crypto = require('crypto');
const express = require('express');
//const request = require('request');
const Twitter = require('twitter');
const path = require('path'); // 
const cors = require('cors'); // https://github.com/expressjs/cors
const bodyParser = require('body-parser');
//https://www.codementor.io/noddy/cookie-management-in-express-js-du107rmna
const cookieParser = require('cookie-parser');
const moment = require('moment')
const Cloudant = require('@cloudant/cloudant'); // https://github.com/cloudant/nodejs-cloudant
require('dotenv').config(); // https://www.npmjs.com/package/dotenv
//var Twitter = require('twitter');

// https://www.npmjs.com/package/express-jwt

class User {
    constructor(props = { roles: [] }) {
        this.playerId = props.playerId;
        this.organizationId = props.organizationId;
        this._id = props._id;
        this._rev = props._rev;
        this.roles = [...props.roles];
        this.passwordHash = props.passwordHash;
    }

    get id() {
        return this._id;
    }

    hasRole(roleName) {
        return this.roles.find(role => role === roleName) !== undefined;
    }

    validatePassword(password) {
        let hash = crypto.createHmac('sha512', process.env.PASSWORD_SECRET);
        hash.update(password);
        let value = hash.digest('hex');
        log('password hash=' + value);
        return value === this.passwordHash;
    }
}
/*
class Role {
    constructor(props = { resourcePermissions: [] }) {
        this.name = props.name;
        this.resourcePermissions = [...props.resourcePermissions];
    }
}*/

const COOKIE_NAME = "upi-guru";

var app = express();
app.use(compression());
app.set('view engine', 'pug');
app.use(bodyParser.json({ limit: '10mb', extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

function contextSetter(req, res, next) {
    req.context = {
        id: generateID(),
        start: new Date().getTime()
    };

    req.logger = new Logger(req.context.id);

    let token = decryptToken(req.signedCookies[COOKIE_NAME]);
    if (token && token.user) {
        req.context.user = new User(token.user);
        req.logger.log("user is " + req.context.user.id);
    }

    next();
}

function requestLogger(req, res, next) {
    req.logger.log(`--> ${req.method} ${req.path}`);
    res.on("finish", () => {
        req.logger.log(`<-- ${req.method} ${res.statusCode} (${new Date().getTime() - req.context.start} ms, ${res.getHeader('content-length') || 0} bytes) ${req.path}`);
    });
    next();
};

function tokenCreator(req, res, next) {
    if (req.signedCookies[COOKIE_NAME] === undefined) {
        req.logger.log('Creating a new token');
        let cookie = {
            version: 2,
            userId: undefined
        }
        res.cookie(COOKIE_NAME, encryptToken(cookie), {
            httpOnly: true,
            signed: true
        });
    }
    next();
}

function encryptToken(token) {
    if (token) {
        let sha256 = crypto.createHash('sha256');
        sha256.update(process.env.COOKIE_SECRET);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-ctr', sha256.digest(), iv);
        let ciphertext = cipher.update(Buffer.from(JSON.stringify(token)));
        return Buffer.concat([iv, ciphertext, cipher.final()]).toString('base64');
    }
}

function decryptToken(token) {
    if (token) {
        let sha256 = crypto.createHash('sha256');
        sha256.update(process.env.COOKIE_SECRET);
        let input = Buffer.from(token, 'base64');
        if (input.length < 17) {
            throw new TypeError('Provided "encrypted" must decrypt to a non-empty string');
        }
        let iv = input.slice(0, 16);
        let decipher = crypto.createDecipheriv('aes-256-ctr', sha256.digest(), iv);

        let ciphertext = input.slice(16);
        let plaintext = decipher.update(ciphertext) + decipher.final();

        return JSON.parse(plaintext);
    }
}

function roleValidator(roles = []) {
    return (req, res, next) => {
        let token = decryptToken(req.signedCookies['upi-guru']);
        if (token === undefined) {
            req.logger.log('No token set');
            res.json(new ServiceError("Keksi puuttuu"));
            return;
        }
        else if (req.context.user === undefined) {
            req.logger.log('User is unknown');
            res.json(new ServiceError("Toiminto vaatii kirjautumisen"));
            return;
        }
        else {
            let hasPermission = false;
            roles.forEach(role => {
                if (req.context.user.hasRole(role)) {
                    hasPermission = true;
                }
            });

            if (!hasPermission) {
                res.json(new ServiceError("Käyttöoikeudet eivät riitä toimenpiteen suoritukseen"));
                return;
            }
        }
        next();
    }
}

app.use(contextSetter);
app.use(requestLogger);

let credentials = getDBCredentials();

// Initialize the library with my account.

if (credentials.account === undefined || credentials.password === undefined) {
    logErrorMessage("Could not read DB credentials");
}

var cloudant;

try {
    let options = {
        url: credentials.url,
        maxAttempt: 5,
        plugins: {
            retry: {
                retryErrors: false,
                retryStatusCodes: [429]
            }
        }
    };

    cloudant = Cloudant(options);
} catch (error) {
    logError(error);
}

function getDBCredentials() {
    if (process.env.VCAP_SERVICES !== undefined) {
        log("Reading DB credentials from VCAP_SERVICES");
        let services = JSON.parse(process.env.VCAP_SERVICES);
        return {
            account: services.cloudantNoSQLDB[0].credentials.username,
            password: services.cloudantNoSQLDB[0].credentials.password,
            url: services.cloudantNoSQLDB[0].credentials.url
        };
    } else {
        log("Reading DB credentials from process.env");
        return {
            account: process.env.DB_ACCOUNT,
            password: process.env.DB_PASSWORD,
            url: process.env.DB_URL
        };
    }
}

/* RENDER TEMPLATE */

app.get("/", tokenCreator, function (req, res) {
    req.logger.log('Opening index page');
    res.render("index");
})

/* HEALTH */

app.post('/health', function (req, res) {
    res.json({ status: "UP" });
})

/* LOGGED USER  */

app.get('/user', (req, res) => {
    if (req.context.user !== undefined) {
        res.json({
            playerId: req.context.user.playerId,
            loggedIn: true
        })
    }
    else {
        res.json({
            loggedIn: false
        })
    }
});

/* LOGIN */

app.post('/login', (req, res, next) => {

    readFromIndexWithFieldAsync('users', 'user-of-player', 'playerId', req.body.playerId).then(
        docs => {
            if (docs.length === 0) {
                req.logger.log("User not found");
                res.json(new ServiceError("Pelaajalle ei ole luotu käyttäjätiliä"));
                return;
            }
            let user = new User(docs[0]);

            if (!user.validatePassword(req.body.password)) {
                req.logger.log("Password incorrect");
                res.json(new ServiceError("Väärä käyttäjätunnus tai salasana"));
                return;
            }
            let token = {
                version: 2,
                playerId: req.body.playerId,
                user
            };
            req.logger.log(`playerId=${req.body.playerId}`);

            res.cookie(COOKIE_NAME, encryptToken(token), {
                httpOnly: true,
                signed: true
            });

            res.json({ ok: true, playerId: user.playerId, organizationId: user.organizationId });
        },
        error => {
            res.json(new ServiceError(error));
        }
    );
})

/* LOGIN */

app.post('/logout', function (req, res, next) {

    let token = {
        version: 2
    };

    res.cookie(COOKIE_NAME, encryptToken(token), {
        httpOnly: true,
        signed: true
    });

    res.json({ ok: true });
})

/* ORGANIZATIONS */

// List all 
app.get('/organizations', cors(), function (req, res, next) {
    readAll("organizations", res);
})

// Get single 
app.get('/organization/:id', cors(), function (req, res, next) {
    readAsync("organizations", req.params.id).then(
        result => {
            res.json(result)
        },
        error => {
            res.json(error)
        }
    );
})

// test: http://localhost:8080/organization/608e2b1ba76ae6e9fd6480658df237c0/players
app.get('/organization/:id/players', cors(), function (req, res, next) {
    readFromIndexWithField("players", "players-in-organization", "organizationId", req.params.id, res);
})

/* USERS */

app.get('/me', function (req, res, next) {
    let token = decryptToken(req.signedCookies[COOKIE_NAME]);
    if (token && token.user) {
        res.json({ loggedIn: true, playerId: token.user.playerId, organizationId: token.user.organizationId });
    }
    else {
        res.json({ loggedIn: false });
    }
})
/*
app.get('/user/:id', cors(), function (req, res, next) {
    read("users", req.params.id, res);
})
*/
/* LEAGUES */

// test: http://localhost:8080/organization/608e2b1ba76ae6e9fd6480658df237c0/leagues
app.get('/organization/:id/leagues', cors(), function (req, res, next) {
    readFromIndexWithField("leagues", "leagues-in-organization", "organizationId", req.params.id, res);
})

// test: http://localhost:8080/league//games
app.get('/league/:leagueId/season/:seasonId/games', cors(), function (req, res, next) {
    readFromIndexWithField("games", "games-in-season", "seasonId", req.params.id, res);
})

// List all 
app.get('/leagues', cors(), function (req, res, next) {
    readAll("leagues", res);
})

// Insert / update 
app.post('/leagues', roleValidator(["admin"]), function (req, res, next) {
    insert("leagues", req.body, res);
})

// Get single 
app.get('/league/:id', cors(), function (req, res, next) {
    read("leagues", req.params.id, res);
})

// Delete
app.delete('/leagues', roleValidator(["admin"]), function (req, res, next) {
    deleteDocument("leagues", req.body._id, req.body._rev, res);
})

// Validate 
app.post('/validate/league', roleValidator(["admin"]), function (req, res, next) {
    res.json(validateLeague(req.body));
})

/* PLAYERS */

// List all 
app.get('/players', cors(), function (req, res, next) {
    readAll("players", res);
})

// Insert / update 
app.post('/players', function (req, res, next) {
    insert("players", req.body, res);
})

// Get single 
app.get('/player/:id', cors(), function (req, res, next) {
    read("players", req.params.id, res);
})

// Delete
app.delete('/players', roleValidator(["admin"]), function (req, res, next) {
    deleteDocument("players", req.body._id, req.body._rev, res);
})

// Validate 
app.post('/validate/player', cors(), function (req, res, next) {
    res.json(validatePlayer(req.body));
})

/* GAMES */

// List all 
app.get('/games', cors(), function (req, res, next) {
    readAll("games", res);
})

// List all games in a season

// test http: //localhost:8080/season/96a2bcb4-77f2-4c4b-8568-698d6acf0ec6/games
app.get('/season/:seasonId/games', cors(), function (req, res, next) {
    readFromIndexWithField("games", "games-in-season", "seasonId", req.params.seasonId, res);
})

// List all games with a playerId

// test: http://localhost:8080/player/12e87ac85b7237566d32fb4f01a512aa/games
app.get('/player/:playerId/games', cors(), function (req, res, next) {
    readFromIndexWithFields("games", "games-of-player", ["player1Id", "player2Id"], [req.params.playerId, req.params.playerId], res);
})

// Insert / update 
app.post('/games', /*roleValidator(["admin"]),*/ function (req, res, next) {
    insertAsync("games", req.body).then(
        result => {
            res.json(result);
        },
        error => {
            res.json(error)
        }
    );
})

// Insert / update / delete all
app.post('/games/all', roleValidator(["admin"]), function (req, res, next) {
    updateAll("games", req.body, res);
})

// Get single 
app.get('/game/:id', cors(), function (req, res, next) {
    read("games", req.params.id, res);
})

// Delete
app.delete('/games', roleValidator(["admin"]), function (req, res, next) {
    deleteDocument("games", req.body._id, req.body._rev, res);
})

/* TROPHIES */

// Get single 
app.get('/trophy/:id', cors(), function (req, res, next) {
    read("trophies", req.params.id, res);
})

// List all trophies in a season

// test http: //localhost:8080/season/96a2bcb4-77f2-4c4b-8568-698d6acf0ec6/trophies
app.get('/season/:seasonId/trophies', cors(), function (req, res, next) {
    readFromIndexWithField("trophies", "trophies-of-season", "seasonId", req.params.seasonId, res);
})

// List all trophies with a playerId

// test: http://localhost:8080/player/d0136e97e2816782cb2dd9a14b7a53a2/trophies
app.get('/player/:playerId/trophies', cors(), function (req, res, next) {
    readFromIndexWithField("trophies", "trophies-of-player", "playerId", req.params.playerId, res);
})

// Insert / update 
app.post('/trophy', roleValidator(["admin"]), function (req, res, next) {
    insert("trophies", req.body, res);
})

// Delete
app.delete('/trophy', roleValidator(["admin"]), function (req, res, next) {
    deleteDocument("trophies", req.body._id, req.body._rev, res);
})

// Validate 
app.post('/validate/trophy', cors(), function (req, res, next) {
    res.json(validateTrophy(req.body));
})

/* LOGS */

// List all logs with a organizationId

// test: http://localhost:8080/organization/608e2b1ba76ae6e9fd6480658df237c0/logs
app.get('/organization/:organizationId/logs', cors(), function (req, res) {
    readFromIndexWithField("logs", "logs-of-organization", "organizationId", req.params.organizationId, res, 5, "timestamp", "desc");
})

// test: http://localhost:8080/season/c7131bbc-4b79-47d4-a9e8-f8cb666bffe0/logs
app.get('/season/:seasonId/logs', cors(), function (req, res) {
    readFromIndexWithField("logs", "logs-of-season", "seasonId", req.params.seasonId, res, 5, "timestamp", "desc");
})

// Insert / update 
app.post('/log', cors(), function (req, res, next) {
    insert("logs", req.body, res);
    tweet(req.body.text);
})

// Delete
app.delete('/log', cors(), function (req, res, next) {
    deleteDocument("logs", req.body._id, req.body._rev, res);
})

function readAll(dbname, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read all documents from ${dbname}`);

    let db = cloudant.db.use(dbname);

    db.list({ include_docs: true }, function (error, data) {
        if (error === null) {
            res.json(data.rows);
        } else {
            handleError(error, res);
        }
    })
}
/*
function fetchAll(dbname, ids, res) {
 
    log(`Read ${ids.length} documents from ${dbname}`);
 
    let db = cloudant.db.use(dbname);
 
    db.fecth(ids, function(error, data) {
        if (error === null) {
            res.json(data.rows);
        } else {
            handleCloudantError(error, res);
        }
    })
}
*/
function readFromIndexWithField(dbname, index, field, value, res, limit, sortField, sortOrder = "asc") {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read documents from ${dbname} using index ${index} with field ${field} having value ${value}`);

    let db = cloudant.db.use(dbname);

    let options = {};

    let selector = {};
    selector[field] = value;
    options.selector = selector;

    if (sortField) {
        let sort = {};
        sort[sortField] = sortOrder;
        options.sort = [sort];
    }

    if (limit) {
        options.limit = limit;
    }

    db.find(options, function (error, data) {
        if (error === null) {
            log(`${data.docs.length} documents found`);
            res.json(data.docs);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function readFromIndexWithFieldAsync(dbname, index, field, value, limit, sortField, sortOrder = "asc") {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read documents from ${dbname} using index ${index} with field ${field} having value ${value}`);

    let db = cloudant.db.use(dbname);

    let options = {};

    let selector = {};
    selector[field] = value;
    options.selector = selector;

    if (sortField) {
        let sort = {};
        sort[sortField] = sortOrder;
        options.sort = [sort];
    }

    if (limit) {
        options.limit = limit;
    }

    return new Promise((resolve, reject) => {
        db.find(options, function (error, data) {
            if (error === null) {
                log(`${data.docs.length} documents found`);
                resolve(data.docs);
            } else {
                logError(error);
                reject(new CloudantError(error));
            }
        });
    });
}

function readFromIndexWithFields(dbname, index, fields, values, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read documents from ${dbname} using index ${index} with fields ${fields.join(", ")} having values ${values.join(", ")}`);

    let db = cloudant.db.use(dbname);

    let selector = {
        "$or": []
    };

    for (let i = 0; i < fields.length; i++) {
        let row = {};
        row[fields[i]] = { "$eq": values[i] };
        selector["$or"][i] = row;
    }

    db.find({ selector: selector }, function (error, data) {
        if (error === null) {
            log(`${data.docs.length} documents found`);
            res.json(data.docs);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function searchFromIndexWithQuery(dbname, designDocument, index, query, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read documents from ${dbname} using desing document ${designDocument} search index ${index} with query ${query}`);

    let db = cloudant.db.use(dbname);

    db.search(designDocument, index, query, function (error, data) {
        if (error === null) {
            log(`${data.docs.length} documents found`);
            res.json(data.docs);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function read(dbname, id, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read doc ${id} from ${dbname}`);

    let db = cloudant.db.use(dbname);

    db.get(id, function (error, data) {
        if (error === null) {
            res.json(data);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function readAllAsync(dbname) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read all documents from ${dbname}`);

    let db = cloudant.db.use(dbname);

    return new Promise((resolve, reject) => {
        db.list({ include_docs: true }, function (error, data) {
            if (error === null) {
                let items = data.rows.filter(row => !row.doc._id.startsWith("_design"));
                resolve(items);
            } else {
                logError(error);
                reject(new CloudantError(error));
            }
        });
    });
}

function readAsync(dbname, id) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Read doc ${id} from ${dbname}`);

    let db = cloudant.db.use(dbname);

    return new Promise((resolve, reject) => {
        db.get(id, (error, data) => {
            if (error === null) {
                resolve(data);
            } else {
                logError(error);
                reject(new CloudantError(error));
            }
        });
    });
}

function insert(dbname, data, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    if (data._rev !== undefined) {
        log(`Update doc ${data._id} at ${dbname}`);
    } else {
        log(`Insert new doc to ${dbname}`);
    }

    let db = cloudant.db.use(dbname);

    db.insert(data, function (error, data) {
        if (error === null) {
            log(`Document ${data.id} saved with rev ${data.rev}`);
            res.json(data);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function insertAsync(dbname, data, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    if (data._id !== undefined) {
        log(`Update doc ${data._id} at ${dbname}`);
    } else {
        log(`Insert new doc to ${dbname}`);
    }

    let db = cloudant.db.use(dbname);

    return new Promise((resolve, reject) => {
        db.insert(data, function (error, data) {
            if (error === null) {
                log(`Document ${data.id} saved with rev ${data.rev}`);
                resolve(data);
            } else {
                logError(error);
                reject(new CloudantError(error));
            }
        });
    });
}

function updateAll(dbname, items, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    let inserts = items.filter(item => item._rev === undefined).length;
    let deletes = items.filter(item => item._deleted !== undefined).length;
    let updates = items.length - (inserts + deletes);

    log(`Insert (${inserts}), update (${updates}) and/or delete (${deletes}) ${items.length} documents in ${dbname}`);

    let db = cloudant.db.use(dbname);

    db.bulk({ docs: items }, function (error, data) {
        if (error === null) {
            res.json(data);
        } else {
            handleCloudantError(error, res);
        }
    });
}

function deleteDocument(dbname, id, rev, res) {

    if (process.env.NODE_ENV !== 'production') {
        dbname = 'test-' + dbname;
    }

    log(`Delete doc ${id} from ${dbname}`);

    let db = cloudant.db.use(dbname);

    db.destroy(id, rev, function (error, data) {
        if (error === null) {
            res.json(data);
        } else {
            handleCloudantError(error, res);
        }
    });
}
/*
function deleteAll(dbname, items, res) {
 
    log(`Delete ${items.length} documents from ${dbname}`);
 
    items.forEach(item => { item._deleted = true });
 
    let db = cloudant.db.use(dbname);
 
    db.bulk({ docs: items }, function (error) {
        if (error === null) {
            res.json({ ok: true });
        } else {
            handleCloudantError(error, res);
        }
    });
}
*/
function validatePlayer(player) {

    log(`Validate player ${player.id !== undefined ? player.id : '(no id)'}`);

    let errors = [];
    if (player !== undefined) {
        if (player.name === undefined || player.name.trim() === "") {
            errors.push({ type: "ERROR", field: "name", message: "Pelaajalla on oltava nimi" });
        }
    }
    return { ok: errors.length === 0, errors };
}

function validateLeague(league) {

    log(`Validate league ${league.id !== undefined ? league.id : '(no id)'}`);

    let errors = [];
    if (league !== undefined) {
        if (league.name === undefined || league.name.trim() === "") {
            errors.push({ type: "ERROR", field: "name", message: "Liigalla/turnauksella on oltava nimi" });
        }
    }
    return { ok: errors.length === 0, errors };
}

function validateTrophy(trophy) {

    log(`Validate trophy ${trophy.id !== undefined ? trophy.id : '(no id)'}`);

    let errors = [];
    if (trophy !== undefined) {
        if (trophy.name === undefined || trophy.name.trim() === "") {
            errors.push({ type: "ERROR", field: "name", message: "Palkinnolla on oltava nimi" });
        }
    }
    return { ok: errors.length === 0, errors };
}

// https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/post-statuses-update
function tweet(message) {

    if (process.env.NODE_ENV !== 'production') {
        console.log("tweet: " + message);
        return;
    }

    if (process.env.TWITTER_CONSUMER_KEY === undefined) {
        return;
    }

    var client = new Twitter({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    });

    client.post('statuses/update', { status: message })
        .then(function (tweet) {
            log("Tweet send!");
        })
        .catch(function (error) {
            logError(error);
        })

    /*
    let options = {
        method: 'PUT',
        url: `https://api.twitter.com/1.1/statuses/update.json?status=${message}`,
        headers: {
            "authorization": `OAuth oauth_consumer_key="YOUR_CONSUMER_KEY",
            oauth_nonce="AUTO_GENERATED_NONCE", oauth_signature="AUTO_GENERATED_SIGNATURE",
            oauth_signature_method="HMAC-SHA1", oauth_timestamp="AUTO_GENERATED_TIMESTAMP",
            oauth_token="USERS_ACCESS_TOKEN", oauth_version="1.0"`,
            "content-type": "application/json"
        }
    };
    request(options, function (error, response, body) {
        if (error) {
            return console.error('upload failed:', error);
        }
        console.log('Upload successful!  Server responded with:', body);
    }*/

}

class ServiceError {
    constructor(error) {
        this.type = "ServiceError";
        this.isError = true;
        this.message = "" + error;
    }
}

class CloudantError {
    constructor(error) {
        this.type = "CloudantError";
        this.isError = true;
        this.message = error.message;
        this.description = error.description;
        this.reason = error.reason;
        this.statusCode = error.statusCode;
    }
}

function handleError(error, res) {
    logError(error);
    res.json(new ServiceError(error));
}

function handleCloudantError(error, res) {
    logError(error);
    res.json(new CloudantError(error));
}

class Logger {
    constructor(id) {
        this.id = id;
    }

    log(message) {
        console.log(`${getTimeStamp()} [${this.id}] ${message}`);
    }
}

function log(message) {
    let timestamp = getTimeStamp();
    console.log(`${timestamp} : ${message}`);
}

function logError(error) {
    logErrorMessage(`${error}`);
    logErrorMessage(`${error.message}`);
    logErrorMessage(`${error.description}`);
    logErrorMessage(`${error.statusCode}`);
}

function logErrorMessage(message) {
    let timestamp = getTimeStamp();
    console.error(`${timestamp} : ${message}`);
}

function getTimeStamp() {
    return moment().format("DD.MM.YYYY HH:mm.ss");
}

function generateID() {
    let id = "";
    for (let i = 0; i < 10; i++) {
        id += ((Math.random() * 16 | 0) & 3 | 8).toString(16);
    }
    return id;
}

function generateUUID() {
    let uuid = "";
    let random;
    for (let i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
            uuid += "-"
        }
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return uuid;
}

app.listen(8080, function () {
    log('-----------------------------------------');
    log('web-upi running at http://localhost:8080/');
    log('-----------------------------------------');
})