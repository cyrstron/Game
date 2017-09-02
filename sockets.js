class Sockets {
	constructor(server) {

		this.io = require('socket.io').listen(server);
		
	    this.io.sockets.on('connection', (socket) => {
			console.log('user connected');

			socket.on('change', (data) => {
				console.log(data);
				socket.broadcast.emit('update', { data: 'newdata' });
			});

			socket.on('disconnect', () => {
				console.log('user disconnected');
			});

	    });
	}

	sendMessage(message, data) {
		this.io.sockets.on('connection', (socket) => {
				socket.broadcast.emit(message, data);
		});
	}

}

module.exports = Sockets;