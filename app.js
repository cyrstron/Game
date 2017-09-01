'use strict';

const EventEmitter = require('events').EventEmitter;
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const pgp = require('pg-promise')();
const jwt = require('jsonwebtoken');
const path = require('path');
const auth = require('./middleware/auth');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');
const logger = require('morgan');
const locationsRoutes = require('./routes/locations.routes');
// const EmptyLocation = require('./models/emptyLocation');
// const OccupiedLocation = require('./models/occupiedLocation');
const schedule = require('node-schedule');
require('dotenv').config();

const app = express();
// const port = process.env.PORT || 8080;
const eventEmitter = new EventEmitter();

let sockets = {};

sockets.init = function (server) {
    // socket.io setup
    let io = require('socket.io').listen(server);
    io.sockets.on('connection', (socket) => {
		console.log('user connected');

		socket.on('change', (data) => {
			console.log(data);
			console.log(data);
			socket.broadcast.emit('update', { data: 'newdata' });
		});

		socket.on('disconnect', () => {
			console.log('user disconnected');
		});
    });

}



global.db = pgp({
	host: 'ec2-23-21-85-76.compute-1.amazonaws.com',
	port: 5432,
	database: 'detamp7dm7n5kt',
	user: process.env.SERVICE_DB_USER || 'smdtzebruscqxv',
	password: process.env.SERVICE_DB_PASS || 'b988acabcae53edc03642deec8eabbbd891f2c549a02100e9f5b134c624ea4cd',
	ssl: true,
	sslfactory: 'org.postgresql.ssl.NonValidatingFactory',
});

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.SERVICE_EMAIL,
		pass: process.env.SERVICE_EMAIL_PASS,
	},
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// middlewares
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('assets'));
app.use(favicon('./assets/favicon.png'));

// ROUTES
app.route('/login')
	.get((req, res) => {
		res.render('login');
	})
	.post((req, res) => {
		const email = req.body['log-email'];
		const password = req.body['log-pass'];

		global.db.one(`SELECT * FROM users
		WHERE email = '${email}';`)
			.then((data) => {
				if (!data.password) {
					res.redirect('/login');					
				}
				if (data.password === password) {
				// create a token
					const payload = {
						id: data.id,
						email: data.email,
						name: data.name,
					};
					const token = jwt.sign(payload, 'secret', {
						expiresIn: 60 * 60 * 24,
					});
					res.cookie('auth', token);
					res.redirect('/');
				} else {
					res.redirect('/login');
				}
			}).catch((err) => {
				res.redirect('/login');
			});
	});

app.post('/register', (req, res) => {
	const name = req.body['reg-name'];
	const email = req.body['reg-email'];
	const pass = req.body['reg-pass'];
	const passCheck = req.body['reg-pass-repeat'];
	if (pass !== passCheck) {
		res.send('Passwords didn\'t match.');
	}

	const newUser = {
		name,
		email,
		pass,
	};

	createNewUser(newUser);
	const letter = createLetter(newUser.email);
	sendMail(letter);
	res.redirect('/');
});

app.use('/', auth);

app.get('/', (req, res) => {
	res.render('index');
});
app.use('/api/locations', locationsRoutes);

app.post('/logout', (req, res) => {
	res.clearCookie('auth');
	res.redirect('/login');
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use((err, req, res) => {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.send(err.message);
	// res.render('error');
});

function createNewUser(user) {
	global.db.none('insert into users(email, password, reg_date, cash, name)' +
`values('${user.email}', '${user.pass}', '${new Date().toISOString()}', 150, '${user.name}')`)
		.then(() => console.log('New user was added to db'))
		.catch(error => console.log('error:', error));
}

function createLetter(userEmail) {
	return {
		from: '"Game team" <gamekh009@gmail.com>', // sender address
		to: userEmail, // receivers
		subject: 'Hello! new user! ✔', // Subject line
		text: 'Hello! We are glad that you joined our game', // plain text body
		html: '<b>Hello! We are glad that you joined our game!</b>', // html body
	};
}

function sendMail(letter) {
	transporter.sendMail(letter, (error, info) => {
		if (error) {
			console.log(error.message);
		} else {
			console.log(`Email sent: ${info.response}`);
		}
	});
}


// schedule.scheduleJob('*/300 * * * * *', () => {
// 	console.log('daily event!');
// 	Location.recalcLocationsLifecycle();
// 	eventEmitter.emit('daily-event');
// });

eventEmitter.on('daily-event', () => {
	console.log('daily event handled!');
});

// global.db.none('delete from locations');

// app.listen(port, () => {
// 	console.log(`Listen on port: ${port}`);
// });

module.exports.app = app;
module.exports.sockets = sockets;