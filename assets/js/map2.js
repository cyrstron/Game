'use strict';

class Game {
	constructor() {
		this.usersGeocordsInfo = document.getElementById('users-geocords');
		this.clickedInfo = document.getElementById('output');
		this.clickedLocationHeading = document.getElementById('click-loc-heading');
		this.clickedLocationInfo = document.getElementById('click-location');
		this.usersLocContainer = document.getElementById('current-loc-info');
		this.usersLocationInfo = document.getElementById('users-location');
		this.occupyBtn = document.getElementById('occupy-btn');

		this.map = null;

		this.userGeoData = null;
		this.currentLocation = null;

		this.occupyBtn.addEventListener('click', () => {
			this.occupyLocation();
		});
	}

	setMapCenter(lat, lng) {
		this.map.setZoom(15);
		this.map.setCenter({ lat, lng });
	}
	addMarker(lat, lng) {
		const marker = new google.maps.Marker({
			position: { lat, lng },
			map: this.map,
			title: 'Hello World!'
		});
	}
	setUserGeoData(position) {
		this.userGeoData = position;
	}

	setStyleLocation(location) {
		let color = 'gray';
		let background = 'white';
		if (location.getProperty('color')) {
			color = location.getProperty('color');
		}
		if (location.getProperty('background')) {
			background = location.getProperty('background');
		}
		return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: background,
			fillOpacity: 0.2,
			strokeColor: color,
			strokeWeight: 2
		});
	}

	renderLocationsFromDB() {
		const getLocationPromise = new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', '/api/locations');
			xhr.send();
			xhr.addEventListener('load', (e) => {
				const srcXHR = e.target;
				if (srcXHR.status === 200) {
					res(JSON.parse(srcXHR.response));
				} else {
					rej(srcXHR.response);
				}
			});
		});

		getLocationPromise.then((locArray) => {
			const geoObj = {
				type: 'FeatureCollection',
				features: []
			};

			// creating geoJSON Object from recieved data

			locArray.forEach((item) => {
				geoObj.features.push({
					type: 'Feature',
					id: item.locationId,
					properties: {
						color: 'green',
						background: 'green',
						info: {
							master: item.masterId
						}
					},
					geometry: {
						type: 'Polygon',
						coordinates: [
							item.mapFeatureGeometry
						]
					}
				});
			});
			console.log(geoObj);

			this.map.data.addGeoJson(geoObj);

			navigator.geolocation.watchPosition((position) => {
				const userCoords = position.coords;
				console.log(userCoords);
				this.setUserGeoData(userCoords);
				this.createCurrentLocation(userCoords);
				this.setMapCenter(userCoords.latitude, userCoords.longitude);
				this.addMarker(userCoords.latitude, userCoords.longitude);
				this.currentCoords = {
					lat: userCoords.latitude,
					lng: userCoords.longitude
				};
			});
		})
			.catch((err) => {
				console.log(err);
			});

		this.map.data.setStyle(this.setStyleLocation);
	}

	createCurrentLocation(currentCoords) {
		this.usersGeocordsInfo.textContent = `${currentCoords.latitude} 
											${currentCoords.longitude}
											${currentCoords.accuracy}`;

		this.usersLocContainer.classList.add('open');

		const getLocationInfoPromise = new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', `/api/locations/check-location?lat=${this.userGeoData.latitude}&lng=${this.userGeoData.longitude}`);
			xhr.send();
			xhr.addEventListener('load', (e) => {
				const getLocationInfoXHR = e.srcElement;

				if (getLocationInfoXHR.status !== 200) {
					rej(getLocationInfoXHR.response);
				}
				res(JSON.parse(getLocationInfoXHR.response));
			});
		});
		getLocationInfoPromise
			.then((locationData) => {
				console.dir(locationData);
				this.currentLocation = locationData;
				if (!locationData.masterId) {
					console.log(locationData);
					if (this.map.data.getFeatureById('currentLocation')) {
						this.map.data.remove(this.map.data.getFeatureById('currentLocation'));
					}
					this.map.data.add(this.createLocation(locationData.mapFeatureCoords));
					this.occupyBtn.style.display = 'block';
				} else {
					const currentLocation = this.map.data.getFeatureById(locationData.locationId);
					currentLocation.setProperty('color', 'crimson');
				}
			})
			.catch((err) => {
				console.log(err);
			});
	}

	createLocation(mapFeatureCoords) {
		const locationGeoObj = {
			type: 'Feature',
			id: 'currentLocation',
			properties: {
				color: 'crimson',
				info: {
					name: 'Current location'
				}
			},
			geometry: new google.maps.Data.Polygon([mapFeatureCoords])
		};
		return locationGeoObj;
	}
	hilightEmptyLocation(event) {
		if (this.map.data.getFeatureById('highlight')) {
			this.map.data.remove(this.map.data.getFeatureById('highlight'));
		}

		const gridPromise = new Promise((res, rej) => {
			const gridXHR = new XMLHttpRequest();
			gridXHR.open('GET', `/api/locations/grid?lat=${event.latLng.lat()}&lng=${event.latLng.lng()}`);
			gridXHR.send();

			gridXHR.onload = (e) => {
				const xhr = e.srcElement;

				if (xhr.status !== 200) {
					rej(xhr.response);
				}

				res(JSON.parse(xhr.response));
			};
		});

		gridPromise
			.then((clickedLocation) => {
				this.clickedInfo.style.display = 'block';
				this.clickedInfo.classList.add('open');
				this.usersLocContainer.classList.remove('open');
				this.clickedLocationInfo.textContent = `${clickedLocation.northWest.lat} ${clickedLocation.northWest.lng}`;
				this.clickedLocationHeading.textContent = 'Empty location';
				console.log(clickedLocation);

				const locationNew = {
					type: 'Feature',
					id: 'highlight',
					properties: {
						color: 'blue'
						// info: {
						//   name: 'Empty location',
						// },
					},
					geometry: new google.maps.Data.Polygon([clickedLocation.mapFeatureCoords])
				};

				this.map.data.add(locationNew);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	occupyLocation() {
		new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('POST', 'api/locations');
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify(this.currentLocation));
			createLocationXHR.addEventListener('load', (e) => {
				const xhr = e.srcElement;
				console.log(xhr);
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				console.log(xhr.response);

				res(JSON.parse(xhr.response));
			});
		})
			.then((newLocation) => {
				console.log(newLocation);
				const thisLocation = this.map.data.getFeatureById('currentLocation');

				const locationNew = {
					type: 'Feature',
					id: newLocation.locationId,
					properties: {
						color: 'green',
						info: {
						}
					},
					geometry: new google.maps.Data.Polygon([newLocation.mapFeatureCoords])
				};
				this.map.data.add(locationNew);
				this.map.data.remove(thisLocation);
				this.occupyBtn.style.display = 'none';
				socket.emit('change', 'new location data');
			})
			.catch((err) => {
				console.log(err);
			});
	}
}

function initMap() {
	const game = new Game();
	game.map = new google.maps.Map(document.getElementById('map'), {
		zoom: 12,
		center: { lat: 49.9891, lng: 36.2322 },
		clickableIcons: false
	});
	window.onload = function () {

		socket.on('update', (data) => {			
			setupMessage('Notification', 'The new location was occupied');
			console.log('new locations added!');									
			game.renderLocationsFromDB();
		});
			
		const lat0 = game.map.getBounds().getNorthEast().lat();
		const lng0 = game.map.getBounds().getNorthEast().lng();
		const lat1 = game.map.getBounds().getSouthWest().lat();
		const lng1 = game.map.getBounds().getSouthWest().lng();
		console.log(lat0, lng0, lat1, lng1);

		game.renderLocationsFromDB();

		game.map.addListener('click', (event) => {
			game.hilightEmptyLocation(event);
		});
	};

	game.usersLocContainer.addEventListener('click', (e) => {
		if (e.target.classList[0] === 'close') {
			game.usersLocContainer.classList.toggle('open');
		}
	});
	game.clickedInfo.addEventListener('click', (e) => {
		if (e.target.classList[0] === 'close') {
			game.clickedInfo.classList.toggle('open');
		}
	});
}
// The function creates a notification with the specified body and header.
function createMessage(title, body) { 
  var container = document.createElement('div');  
  container.innerHTML = '<div class="my-message"> \
    <div class="my-message-title">'+title+'</div> \
    <div class="my-message-body">'+body+'</div> \
  </div>'  
  return container.firstChild
}

// Position
function positionMessage(elem) {
  elem.style.position = 'absolute'

  var scroll = document.documentElement.scrollTop || document.body.scrollTop
  elem.style.top = scroll + 200 + 'px'

  elem.style.right = 20 + 'px'
}

// Running
function setupMessage(title, body) {  
  var messageElem = createMessage(title, body); 
  positionMessage(messageElem);
  document.body.appendChild(messageElem);
  setTimeout(function(){
  	messageElem.parentNode.removeChild(messageElem)
  }, 5000);
}