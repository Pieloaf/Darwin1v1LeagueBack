const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const queryString = require('query-string');
const secrets = require('./secrets.json');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const PORT = 100;
const API_ENDPOINT = 'https://discord.com/api/v8';
const CLIENT_ID = '779767593418227735';
const CLIENT_SECRET = secrets.client;
const BOT_TOKEN = secrets.bot_token;
const GUILD_ID = '779485288996012052';
const REDIRECT_URI = 'https://darwin1v1league.com/login';
const DEV_REDIRECT_URI = 'http://localhost:3000/login';
const SESS_SECRET = secrets.session
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000
const PLAYER_DATA = "user_name,avatar_url,platform,region,elo,victory,defeat,streak,max_streak,user_id"

const DatabaseOptions = {
    host: 'localhost',
    user: 'root',
    password: 'Darwin1vs1%',
    database: 'darwin1v1league'
};
const classes = {
    '804735908867604561': 'grapple',
    '804735963707736115': 'headhunter',
    '804735679664881734': 'jetwings'
};
const supporters = {
    '817095627489148939': 'pink',
    '808322922825252894': 'black',
    '808322708211105833': 'white',
    '806362351430533170': 'purple',
    '806308621347848252': 'green',
    '806362718990368769': 'blue',
    '806365765619941396': 'red',
    '806363058595168308': 'yellow',
    '788288519888961536': 'booster',
};
const achievements = {
    '792081294301200435': 'champion',
    '792081194031513627': 'winner'
};
const ServerOptions = {
    key: fs.readFileSync('./private.key', 'utf8'),
    cert: fs.readFileSync('./public.crt', 'utf8'),
};

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Darwin1vs1%',
    database: 'darwin1v1league',
    debug: false,
    connectionLimitL: 100
});
// const connection = mysql.createConnection(DatabaseOptions);
const sessionStore = new MySQLStore(DatabaseOptions)
app.enable('trust proxy');
app.use(cors());

app.use(session({
    secret: SESS_SECRET,
    name: '1v1league-sid',
    saveUninitialized: false,
    resave: false,
    store: sessionStore,
    cookie: {
        path: '/',
        httpOnly: false,
        maxAge: ONE_WEEK,
        secure: true,
    }
}))

var server = https.createServer(ServerOptions, app).listen(PORT, function () {
    console.log("Express server listening on port " + PORT);
});

server.on('error', (err) => { console.log(err) })

// connection.connect(function (err) {
//     if (err) throw err;
//     console.log("Connected!");
// });



function SELECT_PLAYERS(platform, region) {

    if (platform == 'global' || !platform) {
        if (region) {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where region = "${region}" and victory+defeat >= 1 order by elo desc, (victory/(victory+defeat)) desc`
        }
        else {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where victory+defeat >= 1 order by elo desc, (victory/(victory+defeat)) desc`
        }
    }
    else {
        if (region) {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where platform = "${platform}" and region = "${region}" and victory+defeat >= 1 order by elo desc, (victory/(victory+defeat)) desc`
        }
        else {
            return `select @r:=@r+1 as ranking,${PLAYER_DATA}\n` +
                `from players,(select @r:=0) as r where platform = "${platform}" and victory+defeat >= 1 order by elo desc, (victory/(victory+defeat)) desc`
        }
    }
}

function GET_USER(user) {
    if (user) {
        return `select * from (select @g:=@g+1 as q_rank,g_rank,${PLAYER_DATA} from (select * from (select @r:=@r+1 as g_rank,${PLAYER_DATA} from players,(select @r:=0) as r order by (victory+defeat >= 1) desc, elo desc) as grank) as qrank,(select @g:=0) as g where platform = (select platform from players where user_id = ${user}) and region = (select region from players where user_id = ${user}) order by (victory+defeat >= 1) desc, elo desc) as stats where user_id = ${user}`
    }
}

function GET_GAMES(user) {
    return `SELECT ROW_NUMBER() OVER(ORDER BY timestamp ASC) AS num_row, user_name AS loser, winner, elo_gain, elo_loss, timestamp, winner_id, loser_id FROM (SELECT user_name AS winner, loser, elo_gain, elo_loss, timestamp, winner_id, loser_id FROM (SELECT winner, elo_gain, loser, elo_loss, timestamp, g.winner as winner_id, g.loser as loser_id FROM games g WHERE g.loser = ${user} OR g.winner = ${user}) AS games LEFT JOIN players p ON games.winner = p.user_id) AS games LEFT JOIN players p ON games.loser = p.user_id ORDER BY timestamp DESC;`
}

async function exchange_code(grant_code) {
    let reqData = queryString.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: grant_code,
        redirect_uri: REDIRECT_URI,
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

async function get_roles(user_id) {
    let config = {
        headers: {
            'Authorization': `Bot ${BOT_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }
    return await axios.get(`${API_ENDPOINT}/guilds/${GUILD_ID}/members/${user_id}`, config)
}
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", true);
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Methods", "GET");
    next();
});
app.get('/', function (req, res) {
    return res.type('json').send(
        "Heyo, welcome to the backend :P\n\nHere\'s a list of end points you can use :)\t\n/leaderboard\t\n/leaderboard/:platform\t\n/leaderboard/:platform/:region\t\n/user/:user_id\t\n/games/:user_id\t\n/patches/:season", null, '\n');
})

app.get('/leaderboard', function (req, res) {
    pool.query(SELECT_PLAYERS(), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/leaderboard/:platform', function (req, res) {
    pool.query(SELECT_PLAYERS(req.params.platform), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})

app.get('/leaderboard/:platform/:region', function (req, res) {
    pool.query(SELECT_PLAYERS(req.params.platform, req.params.region), (err, results) => {
        if (err) {
            return res.status(500).send(err)
        } else {
            return res.json(results)
        }
    })
})



app.get('/user', async function (req, res) {
    let player_classes = []
    let player_achievements = []
    let user = req.session.user_id
    try {
        let player_roles = await get_roles(user)
        player_roles.data.roles.forEach(role => {
            if (role in classes) player_classes.push(classes[role])
            else if (role in achievements) player_achievements.push(achievements[role])
        })
    }
    catch (err) {

    }
    pool.query(GET_USER(user), (err, results) => {
        if (err) {
            if (err.errno === 1054) {
                return res.json([])
            } else if (err.errno === 1065) {
                return res.json([])
            }
            return res.status(500).send(err)
        } else {
            results.push({ 'classes': player_classes })
            results.push({ 'achievements': player_achievements })
            return res.json(results)
        }
    })

})


app.get('/user/:user_id', async function (req, res) {
    let player_classes = []
    let player_achievements = []
    let user = req.params.user_id
    try {
        let player_roles = await get_roles(user)
        player_roles.data.roles.forEach(role => {
            if (role in classes) player_classes.push(classes[role])
            else if (role in achievements) player_achievements.push(achievements[role])
        })
    }
    catch (err) {

    }
    pool.query(GET_USER(user), (err, results) => {
        if (err) {
            if (err.errno === 1054) {
                return res.json([])
            } else if (err.errno === 1065) {
                return res.json([])
            }
            return res.status(500).send(err)
        } else {
            results.push({ 'classes': player_classes })
            results.push({ 'achievements': player_achievements })
            return res.json(results)
        }
    })

})


app.get('/login/:code', async function (req, res) {
    try {
        const results = await exchange_code(req.params.code)
        const user = await get_discord_user(results.data.access_token)
        req.session.user_id = user.data.id
        return res.json({ 'loggedIn': true });
    } catch (err) {
        return res.status(500).send(err)
    }
})

app.get('/games', function (req, res) {
    let user = req.session.user_id
    pool.query(GET_GAMES(`${user}`), (err, results) => {
        if (err) {
            if (err.errno === 1054) {
                return res.json([])
            } else if (err.errno === 1065) {
                return res.json([])
            }
            return res.status(500).send(err)
        } else {
            results.push({ 'user_id': user })
            return res.json(results)
        }
    })
})

app.get('/games/:user_id', function (req, res) {
    let user = req.params.user_id
    pool.query(GET_GAMES(`${user}`), (err, results) => {
        if (err) {
            if (err.errno === 1054) {
                return res.json([])
            } else if (err.errno === 1065) {
                return res.json([])
            }
            return res.status(500).send(err)
        } else {
            results.push({ 'user_id': user })
            return res.json(results)
        }
    })
})

app.get('/patches/:season', function (req, res) {
    try {
        results = fs.readFileSync('./patch_notes/' + req.params.season + '.json', 'utf8')
        return res.send(results)
    } catch (err) {
        return res.status(500).send(err)
    }
})