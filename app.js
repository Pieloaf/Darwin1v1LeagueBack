const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const fs = require('fs');
const https = require('https');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const axios = require('axios');
const queryString = require('query-string');
const secrets = require('./secrets.json')

const PORT = 100;
const API_ENDPOINT = 'https://discord.com/api/v8';
const CLIENT_ID = '779767593418227735';
const CLIENT_SECRET = secrets.client;
const REDIRECT_URI = 'https://darwin1v1league.com/login';
const DEV_REDIRECT_URI = 'http://localhost:3000/login';
const SESS_SECRET = secrets.session
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

const DatabaseOptions = {
    host: 'localhost',
    user: 'root',
    password: 'Darwin1vs1%',
    database: 'darwin1v1league'
};

const ServerOptions = {
    key: fs.readFileSync('./private.key', 'utf8'),
    cert: fs.readFileSync('./public.crt', 'utf8'),
};

const connection = mysql.createConnection(DatabaseOptions);
const sessionStore = new MySQLStore(DatabaseOptions)

app.use(cors());
app.use(session({
    secret: SESS_SECRET,
    name: '1v1league.sid',
    saveUninitialized: false,
    resave: false,
    store: sessionStore,
    cookie: {
        path: '/',
        httpOnly: false,
        maxAge: ONE_WEEK,
        secure: true,
        // domain: 'http://localhost:3000'
    }
}))

https.createServer(ServerOptions, app).listen(PORT, function () {
    console.log("Express server listening on port " + PORT);
});

connection.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

const PLAYER_DATA = "user_name,avatar_url,platform,region,elo,victory,defeat,streak"

function SELECT_PLAYERS(platform, region) {

    if (platform == 'global' || !platform) {
        if (region) {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where region = "${region}" and victory+defeat >= 10 order by elo desc, (victory/(victory+defeat)) desc`
        }
        else {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where victory+defeat >= 10 order by elo desc, (victory/(victory+defeat)) desc`
        }
    }
    else {
        if (region) {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where platform = "${platform}" and region = "${region}" and victory+defeat >= 10 order by elo desc, (victory/(victory+defeat)) desc`
        }
        else {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where platform = "${platform}" and victory+defeat >= 10 order by elo desc, (victory/(victory+defeat)) desc`
        }
    }
}
function GET_USER(user) {
    if (user) {
        return `select * from (select @g:=@g+1 as q_rank,g_rank,user_id,${PLAYER_DATA} from (select * from (select @r:=@r+1 as g_rank,user_id,${PLAYER_DATA} from players,(select @r:=0) as r order by (victory+defeat >= 10) desc, elo desc) as grank) as qrank,(select @g:=0) as g where platform = (select platform from players where user_id = ${user}) and region = (select region from players where user_id = ${user}) order by (victory+defeat >= 10) desc, elo desc) as stats where user_id = ${user}`
    }
}

function GET_GAMES(user) {
    return `SELECT ROW_NUMBER() OVER(ORDER BY timestamp ASC) AS num_row, user_name AS loser, winner, elo_gain, elo_loss, timestamp FROM (SELECT user_name AS winner, loser, elo_gain, elo_loss, timestamp FROM (SELECT winner, elo_gain, loser, elo_loss, timestamp FROM games g WHERE g.loser = ${user} OR g.winner = ${user}) AS games LEFT JOIN players p ON games.winner = p.user_id) AS games LEFT JOIN players p ON games.loser = p.user_id ORDER BY timestamp DESC;`
}

async function exchange_code(grant_code) {
    console.log('grant', grant_code)
    let reqData = queryString.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: grant_code,
        redirect_uri: DEV_REDIRECT_URI,
        scope: 'identify guilds'
    })
    let config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }
    const response = await axios.post(`${API_ENDPOINT}/oauth2/token`, reqData, config).catch(err => console.log(err.data));
    return response
}

async function get_discord_user(access_token) {
    let config = {
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }
    return await axios.get(`${API_ENDPOINT}/users/@me`, config)
}

app.get('/leaderboard', function (req, res) {
    connection.query(SELECT_PLAYERS(), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/leaderboard/:platform', function (req, res) {
    connection.query(SELECT_PLAYERS(req.params.platform), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/leaderboard/:platform/:region', function (req, res) {
    connection.query(SELECT_PLAYERS(req.params.platform, req.params.region), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/user/:user_id', function (req, res) {
    connection.query(GET_USER(req.params.user_id), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/login/:code', async function (req, res) {
    try {
        // const results = await exchange_code(req.params.code)
        const user = await get_discord_user(await exchange_code(req.params.code).data.access_token)
        return res.json(user.data.id);
    } catch (err) {
        console.log(err)
    }
})

app.get('/games/:user_id', async function (req, res) {
    connection.query(GET_GAMES(req.params.user_id), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})