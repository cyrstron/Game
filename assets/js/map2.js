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


		this.userGeoData = null;

		this.relativeLatSize = null;
		this.relativeLngSize = null;
		this.latBreakPoints = [];
		this.lngSizeCoefficients = {};

		this.userLocationPromise = this.getUserLocationPromise();
		// this.currentCoords = null;

		this.userLocationPromise.then((userCoords) => {
			console.log(userCoords);
			// this.currentCoords = userCoords;
			this.createCurrentLocation(userCoords);
			this.setUserGeoData(userCoords);
			map.setZoom(15);
			map.setCenter({ lat: userCoords.latitude, lng: userCoords.longitude });
			this.currentCoords = {
				lat: userCoords.latitude,
				lng: userCoords.longitude,
			};
		});

		this.initLocationGrid();

		this.occupyBtn.addEventListener('click', () => {
			this.occupyLocation();
		});
	}

	setMapCenter() {
		map.setZoom(15);
		map.setCenter({ lat: this.currentCoords.lat, lng: this.currentCoords.lng });
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
			strokeWeight: 2,
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
				features: [],
			};

			// creating geoJSON Object from recieved data

			locArray.forEach((item) => {
				geoObj.features.push({
					type: 'Feature',
					id: item.loc_id,
					properties: {
						color: 'green',
						background: 'green',
						info: {
							master: item.master,
						},
					},
					geometry: {
						type: 'Polygon',
						coordinates: [
							this.getLocationPointsByTopLeft({
								lat: item.lat,
								lng: item.lng,
							}, true),
							// [[
							// 	+item.lng, +item.lat,
							// ], [
							// 	+item.lng, ((item.lat * 100) + 1) / 100,
							// ], [
							// 	((item.lng * 100) + 1) / 100, ((item.lat * 100) + 1) / 100,
							// ], [
							// 	((item.lng * 100) + 1) / 100, +item.lat,
							// ], [
							// 	+item.lng, +item.lat,
							// ]],
						],
					},
				});
			});
			console.log(geoObj);

			map.data.addGeoJson(geoObj);
		})
			.catch((err) => {
				console.log(err);
			});

		map.data.setStyle(this.setStyleLocation);
	}


	getRelLngSize(topLeftLat) {
		if (topLeftLat < 0) {
			topLeftLat = (topLeftLat - (this.relativeLatSize / 10000000)) * (-1);
		}

		if (topLeftLat <= this.latBreakPoints[0]) {
			return this.relativeLngSize;
		}

		for (let i = 0, maxValue = this.latBreakPoints.length; i < maxValue; i += 1) {
			if (
				(topLeftLat > this.latBreakPoints[i] && topLeftLat <= this.latBreakPoints[i + 1]) ||
				(topLeftLat > this.latBreakPoints[i] && !this.latBreakPoints[i + 1])
			) {
				return this.relativeLngSize * this.lngSizeCoefficients[this.latBreakPoints[i]];
			}
		}
	}

	initLocationGrid(options) {
		options = options || {};
		const preferableLocSideSize = options.preferableLocSideSize || 100;
		const EARTH_EQUATOR_LENGTH = options.EARTH_EQUATOR_LENGTH || 40075696;
		const EARTH_MERIDIAN_LENGTH = options.EARTH_MERIDIAN_LENGTH || 20004274;

		const locSideMetersSizeOn30Lat = preferableLocSideSize;
		const locSideMetersSizeOnEquatorLat = locSideMetersSizeOn30Lat * 1.5;
		const minAbsoluteLatSize = EARTH_MERIDIAN_LENGTH / 1800000000;
		const minAbsoluteLngSize = EARTH_EQUATOR_LENGTH / 3600000000;

		this.relativeLatSize = this.getClosestRelSize(Math.round(preferableLocSideSize / minAbsoluteLatSize), 'lat');
		this.relativeLngSize = this.getClosestRelSize(Math.round(locSideMetersSizeOnEquatorLat / minAbsoluteLngSize), 'lng');

		let lngPrimeFactorsArr = this.findPrimeFactors(3600000000 / this.relativeLngSize);
		lngPrimeFactorsArr.splice(-1);

		lngPrimeFactorsArr = lngPrimeFactorsArr.map((item) => {
			if (item > 2) {
				return [item / 2, 2];
			}
			return item;
		});

		for (let i = 0; i < lngPrimeFactorsArr.length; i += 1) {
			if (Array.isArray(lngPrimeFactorsArr[i])) {
				const innerArr = lngPrimeFactorsArr.splice(i, 1)[0];
				i -= 1;
				innerArr.forEach((currentValue) => {
					lngPrimeFactorsArr.push(currentValue);
				});
			}
		}

		let lngSizeCoefficient = 1;

		lngPrimeFactorsArr.forEach((currentValue) => {
			lngSizeCoefficient *= currentValue;
			let lngBreakPoint = (Math.acos(1 / lngSizeCoefficient) * 180) / Math.PI;
			lngBreakPoint = (Math.floor(Math.round(lngBreakPoint * 10000000) / this.relativeLatSize) * this.relativeLatSize) / 10000000;
			this.lngSizeCoefficients[lngBreakPoint] = lngSizeCoefficient;
			this.latBreakPoints.push(lngBreakPoint);
		});
		console.dir(this.lngSizeCoefficients);
	}

	getClosestRelSize(preferRelSize, latOrLng) {
		let maxDeg;
		if (latOrLng === 'lat') {
			maxDeg = 1800000000;
		} else if (latOrLng === 'lng') {
			maxDeg = 3600000000;
		} else {
			return false;
		}

		if (Math.round(maxDeg / preferRelSize) === maxDeg / preferRelSize) {
			return preferRelSize;
		}

		if (Math.round(maxDeg / preferRelSize) !== maxDeg / preferRelSize) {
			let relativeSizeToIncrease = preferRelSize;
			let relativeSizeToDecrease = preferRelSize;
			while (true) {
				relativeSizeToIncrease += 1;
				relativeSizeToDecrease -= 1;
				if (Math.round(maxDeg / relativeSizeToIncrease) === maxDeg / relativeSizeToIncrease) {
					return relativeSizeToIncrease;
				}

				if (Math.round(maxDeg / relativeSizeToDecrease) === maxDeg / relativeSizeToDecrease) {
					return relativeSizeToDecrease;
				}
			}
		}
	}
	findPrimeFactors(value) {
		let tempValue = value;
		let checker = 2;
		const result = [];

		while (checker * checker <= tempValue) {
			if (tempValue % checker === 0) {
				result.push(checker);
				tempValue /= checker;
			} else {
				checker += 1;
			}
		}
		if (tempValue !== 1)	{
			result.push(tempValue);
		}
		return result;
	}

	getUserLocationPromise() {
		const createCurrentLocatonPromise = new Promise((res, rej) => {
			navigator.geolocation.watchPosition((position) => {
				// console.log(position);
			  res(position.coords);
			}, (err) => {
			  rej(err);
			}, {
			  enableHighAccuracy: true,
			  maximumAge: 0,
			});
		  });

		return createCurrentLocatonPromise;
	}

	createCurrentLocation(currentCoords) {
		this.usersGeocordsInfo.textContent = `${currentCoords.latitude} 
											${currentCoords.longitude}
											${currentCoords.accuracy}`;

		this.usersLocContainer.style.display = 'block';

		const currentLocationCoords = this.getTopLeftLocationCoordsByPoint(currentCoords.latitude,	currentCoords.longitude);

		this.usersLocationInfo.textContent = `${currentLocationCoords.lat} 
											 ${currentLocationCoords.lng}`;

		const getLocationInfoPromise = new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', `/api/locations/${currentLocationCoords.lat}${currentLocationCoords.lng}`);
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
				if (!locationData.loc_id) {
					console.log(locationData);
					if (map.data.getFeatureById('currentLocation')) {
						map.data.remove(map.data.getFeatureById('currentLocation'));
					}
					map.data.add(this.createLocation(currentLocationCoords));
				} else {
					const currentLocation = map.data.getFeatureById(locationData.loc_id);
					currentLocation.setProperty('color', 'crimson');
				}
			})
			.catch((err) => {
				console.log(err);
			});
	}

	getLocationPointsByTopLeft(topLeftCoords, isForMapArray) {
		if (!isForMapArray) {
			return [{
			// north west
				lat: +topLeftCoords.lat,
				lng: +topLeftCoords.lng,
			}, {
			// south west
				lat: ((topLeftCoords.lat * 10000000) - this.relativeLatSize) / 10000000,
				lng: +topLeftCoords.lng,
			}, {
			// south east
				lat: ((topLeftCoords.lat * 10000000) - this.relativeLatSize) / 10000000,
				lng: ((topLeftCoords.lng * 10000000) + this.getRelLngSize(topLeftCoords.lat)) / 10000000,
			}, {
			// north east
				lat: +topLeftCoords.lat,
				lng: ((topLeftCoords.lng * 10000000) + this.getRelLngSize(topLeftCoords.lat)) / 10000000,
			}];
		}
		return [[
			// north west
			+topLeftCoords.lng,
			+topLeftCoords.lat,
		], [
			// south west
			+topLeftCoords.lng,
			((topLeftCoords.lat * 10000000) - this.relativeLatSize) / 10000000,
		], [
			// south east
			((topLeftCoords.lng * 10000000) + this.getRelLngSize(topLeftCoords.lat)) / 10000000,
			((topLeftCoords.lat * 10000000) - this.relativeLatSize) / 10000000,
		], [
			// north east
			((topLeftCoords.lng * 10000000) + this.getRelLngSize(topLeftCoords.lat)) / 10000000,
			+topLeftCoords.lat,
		], [
			// north west
			+topLeftCoords.lng,
			+topLeftCoords.lat,
		]];
	}
	createLocation(locationCoords) {
		const location = this.getLocationPointsByTopLeft(locationCoords);
		const locationGeoObj = {
			type: 'Feature',
			id: 'currentLocation',
			properties: {
				color: 'crimson',
				info: {
					name: 'Current location',
				},
			},
			geometry: new google.maps.Data.Polygon([location]),
		};
		return locationGeoObj;
	}
	hilightEmptyLocation(event) {
		if (map.data.getFeatureById('highlight')) {
			map.data.remove(map.data.getFeatureById('highlight'));
		}

		const topLeftCoords = this.getTopLeftLocationCoordsByPoint(event.latLng.lat(), event.latLng.lng());

		this.getTopLeftLocationCoordsByPoint(this.currentCoords.latitude,	this.currentCoords.longitude);
		const lat = topLeftCoords.lat;
		const lng = topLeftCoords.lng;

		// const lat = Math.floor(event.latLng.lat() * 100) / 100;
		// const lng = Math.floor(event.latLng.lng() * 100) / 100;

		this.clickedInfo.style.display = 'block';
		// clickedCordsInfo.textContent = `${event.latLng.lat()} ${event.latLng.lng()}`;
		this.clickedLocationInfo.textContent = `${lat} ${lng}`;

		const location = this.getLocationPointsByTopLeft(topLeftCoords);

		// const location = [
		// 	{ lat, lng }, // north west
		// 	{ lat: ((lat * 100) + 1) / 100, lng }, // south west
		// 	{ lat: ((lat * 100) + 1) / 100, lng: ((lng * 100) + 1) / 100 }, // south east
		// 	{ lat, lng: ((lng * 100) + 1) / 100 }, // north east
		// ];

		const locationNew = {
			type: 'Feature',
			id: 'highlight',
			properties: {
				color: 'blue',
				// info: {
				//   name: 'Empty location',
				// },
			},
			geometry: new google.maps.Data.Polygon([location]),
		};
		console.log(locationNew);
		map.data.add(locationNew);
		this.clickedLocationHeading.textContent = 'Empty location';
		// setTimeout(() => {
		//   if (!confirm('Поставить поселение?')) {
		//     map.data.remove(map.data.getFeatureById(locationNew.id));
		//     console.log(map.data.getFeatureById(locationNew.id));
		//   }
		//   // here post request for create location
		// }, 1000);
	}

	getTopLeftLocationCoordsByPoint(pointLat, pointLng) {
		const lat = (Math.ceil(Math.round(pointLat * 10000000) /	this.relativeLatSize) * this.relativeLatSize) / 10000000;
		const lng = (Math.floor(Math.round(pointLng * 10000000) / this.getRelLngSize(lat)) * this.getRelLngSize(lat)) / 10000000;

		return {
			lat,
			lng,
		};
	}

	occupyLocation() {
		const createLocatonPromise = new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('POST', 'api/locations');
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify({
				userLat: this.userGeoData.latitude,
				userLng: this.userGeoData.longitude,
				accuracy: this.userGeoData.accuracy,
			}));
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
			.then((response) => {
				console.log(response);
				const thisLocation = map.data.getFeatureById('currentLocation');

				const location = this.getLocationPointsByTopLeft(response);

				const locationNew = {
					type: 'Feature',
					id: response.locationId,
					properties: {
						color: 'green',
						info: {
						},
					},
					geometry: new google.maps.Data.Polygon([location]),

				};
				map.data.add(locationNew);
				map.data.remove(thisLocation);
				socket.emit('change', response);  //<------------------------------------------

			})
			.catch((err) => {
				console.log(err);
			});
	}
}


let map;

function initMap() {
	map = new google.maps.Map(document.getElementById('map'), {
		zoom: 12,
		center: { lat: 49.9891, lng: 36.2322 },
		clickableIcons: false,
	});
	window.onload = function () {
		const game = new Game();

		const lat0 = map.getBounds().getNorthEast().lat();
		const lng0 = map.getBounds().getNorthEast().lng();
		const lat1 = map.getBounds().getSouthWest().lat();
		const lng1 = map.getBounds().getSouthWest().lng();
		console.log(lat0, lng0, lat1, lng1);

		game.renderLocationsFromDB();


		map.addListener('click', (event) => {
			game.hilightEmptyLocation(event);
		});
	};
}
