//James Fisher
import express from 'express';
import bcrypt from 'bcrypt';
import session from 'express-session';
import dotenv from 'dotenv';
import sql from './db.js'

dotenv.config();

const app = express();
const weatherKey = process.env.API_KEY;
let weatherBaseUrl = 'https://api.tomorrow.io/v4/weather/forecast';

app.set('view engine', 'ejs')
app.use(express.static('public'))

// Express needs the following line to parse data sent using the post method.
app.use(express.urlencoded({extended:true}));

app.use('/node_modules', express.static('node_modules'));
// Express Session specific
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))

app.use(async (req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.auth = req.session.authenticated;
    res.locals.locations = await getLocations();
    next();
});


function isAuthenticated(req, res, next) {
    if (req.session.authenticated === true) {
        next();
    } else {
        res.redirect('/');
    }
}

function isAuthenticatedAdmin(req, res, next) {
    if (req.session.authenticated === true && req.session.admin === true) {
        next();
    } else {
        res.redirect('/');
    }
}

function isNotAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        let username = req.session.username;
        let email = req.session.email;
        return res.redirect('/profile', {username, email});
    }
    next();
}

function assembleUrl(zip, units) {
    const params = new URLSearchParams({
        location: zip + " US",
        timesteps: "1d",
        units: units,
        apikey: weatherKey
    });

    return `${weatherBaseUrl}?${params.toString()}`;
}

async function getLocations() {
    const rows = await sql`SELECT * FROM saved_locations`
    return rows
}

async function getWeather(zip, units) {
    let response = await fetch(assembleUrl(zip, units));
    return await response.json();
}

//routes
app.get('/', async (req, res) => {
    let weather;
    let units = "imperial";
    if (req.session.authenticated) {
        let userId = req.session.userId;
        console.log('userId:', userId)
        const rows = await sql`SELECT * FROM userPreferences WHERE user_id = ${userId}`
        console.log(rows)
        units = rows[0].user_temp
        weather = await getWeather(rows[0].zipcode, units)
    } else {
        weather = await getWeather(95060, "imperial")
    }
    let location = weather.location.name;
    res.render('home.ejs', {weather, location, units});
});

 app.get('/location', async (req, res) => {
     let weather;
     let units = "imperial";
     if (req.session.authenticated) {
         let userId = req.session.userId;
         const rows = await sql`SELECT * FROM userPreferences WHERE user_id = ${userId}`;
         units = rows[0].user_temp;
         weather = await getWeather(req.query.location, units);
     } else {
         weather = await getWeather(req.query.location, "imperial")
     }
     const data = await sql`SELECT * FROM saved_locations WHERE zipcode = ${req.query.location}`
     let location = data[0].location_name;
     res.render('location.ejs', {weather, location, units});
 });

 app.get('/search', async (req, res) => {
     let weather;
     let units = "imperial";
     let zipcode  = req.query.zipcode;
     if (req.session.authenticated) {
         let userId = req.session.userId;
         const rows = await sql`SELECT * FROM userPreferences WHERE user_id = ${userId}`
         units = rows[0].user_temp;
         weather = await getWeather(zipcode, units);
     } else {
         weather = await getWeather(zipcode, "imperial")
     }
     let location = weather.location.name;
     res.render('search.ejs', {weather, location, units});
 });

app.get('/logout',isAuthenticated, (req, res) => {
    req.session.destroy();
    res.redirect('/');
})

app.get("/dbTest", async(req, res) => {
    const rows = await sql`SELECT CURRENT_DATE`;
    res.send(rows);
});//dbTest

app.get('/admin', isAuthenticatedAdmin, async (req, res) => {
    const users = await sql`SELECT * FROM "user"`;
    res.render('admin', {users});
});

app.post('/admin/users/:id/edit', isAuthenticatedAdmin, async (req, res) => {
    const userId = req.params.id;
    const { username, email, is_admin } = req.body;

    await sql`UPDATE "user" SET username = ${username}, email = ${email}, is_admin = ${is_admin} WHERE user_id = ${userId}`;
    res.redirect('/admin');
});

app.post('/admin/users/:id/delete', isAuthenticatedAdmin, async (req, res) => {
    const userId = req.params.user_id;

    await sql`DELETE FROM "user" WHERE id = ${userId}`;
    res.redirect('/admin');
});

app.get('/profile', isAuthenticated, async (req, res) => {
    let username = req.session.username;
    let email = req.session.email;
    let image = req.session.image;
    let zipCode = req.session.zipCode;
    let tempUnit = req.session.userTemp;
    
    
    if (req.session.admin) {
        res.redirect('/admin');
        return;
    }
    res.render('profile', {
        username,
        email,
        tempUnit,
        zipCode,
        image,
    });
});

app.post('/profile', isAuthenticated, async (req, res) => {
    const { email, tempUnit, savedLocation} = req.body;
    const backgroundImage = req.body.backgroundImage || 'default'
    const userId = req.session.userId;
    console.log({ email, tempUnit, savedLocation, backgroundImage, userId })
    await sql`UPDATE "user" SET email = ${email} WHERE user_id = ${userId}`

    const existingPreference = await sql`SELECT * FROM userPreferences WHERE user_id = ${userId}`

    if (existingPreference.length > 0) {
        await sql`UPDATE userPreferences SET user_temp = ${tempUnit}, zipcode = ${savedLocation}, image = ${backgroundImage} WHERE user_id = ${userId}`
    } else {
        await sql`INSERT INTO userPreferences (user_id, user_temp, zipcode, image) VALUES (${userId}, ${tempUnit}, ${savedLocation}, ${backgroundImage})`
    }

    req.session.email = email
    req.session.userTemp = tempUnit
    req.session.zipCode = savedLocation
    req.session.image = backgroundImage
    res.redirect('/profile')

});

app.post('/login',isNotAuthenticated, async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    const rows = await sql`
    SELECT "user".*, userPreferences.user_temp, userPreferences.image, userPreferences.zipcode
    FROM "user"
    LEFT JOIN userPreferences ON "user".user_id = userPreferences.user_id
    WHERE "user".username = ${username}`
    if (rows.length <= 0) {
        res.redirect('/');
        return;
    }
    let passwordHash = rows[0].password;
    let match = await bcrypt.compare(password, passwordHash);
    if (match) {
        req.session.username = rows[0].username;
        req.session.email = rows[0].email;
        req.session.authenticated = true;
        req.session.admin = rows[0].is_admin;
        req.session.userId = rows[0].user_id;
        req.session.userTemp = rows[0].user_temp;
        req.session.image = rows[0].image;
        req.session.zipCode = rows[0].zipcode;
        res.redirect('/profile');
    } else {
        res.redirect('/login');
    }

});
app.get('/register', isNotAuthenticated, (req, res) => {
    let error = '';
    res.render('register', {error});
});
app.post('/register', async (req, res) => {
    let username = req.body.username
    let email = req.body.email
    let password = req.body.password
    let confirmPassword = req.body.confirmPassword

    if (password !== confirmPassword) {
        let error = "Passwords do not match"
        res.render('register', {error})
        return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await sql`INSERT INTO "user" (username, email, password) VALUES (${username}, ${email}, ${hashedPassword})`

    const userid = await sql`SELECT user_id FROM "user" WHERE username = ${username}`

    await sql`INSERT INTO userPreferences (user_id, zipcode, user_temp, image) VALUES (${userid[0].user_id}, ${93955}, ${'imperial'}, ${'default'})`

    res.redirect('/login')
})

app.get('/login',isNotAuthenticated, async (req, res) => {
    res.render('login');
})
app.get('/home', (req, res) => {
    res.render('home');
});

app.listen(3001, ()=>{
    console.log("Express server running")
})