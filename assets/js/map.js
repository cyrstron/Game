'use strict';

let map;

function initMap() {
	const usersGeocordsInfo = document.getElementById('users-geocords');
	const clickedInfo = document.getElementById('output');
	// const clickedCordsInfo = document.getElementById('click-geocords');
	const clickedLocationHeading = document.getElementById('click-loc-heading');
	const clickedLocationInfo = document.getElementById('click-location');
	const usersLocContainer = document.getElementById('current-loc-info');
	const usersLocationInfo = document.getElementById('users-location');
	const occupyBtn = document.getElementById('occupy-btn');

	let userGeoData;

	occupyBtn.addEventListener('click', occupyLocation);

	map = new google.maps.Map(document.getElementById('map'), {
		zoom: 12,
		center: { lat: 49.9891, lng: 36.2322 },
		clickableIcons: false,
	});

	// getting locations for rendering on map
	window.onload = function () {
		const lat0 = map.getBounds().getNorthEast().lat();
		const lng0 = map.getBounds().getNorthEast().lng();
		const lat1 = map.getBounds().getSouthWest().lat();
		const lng1 = map.getBounds().getSouthWest().lng();
		console.log(lat0, lng0, lat1, lng1);

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
						info: {
							master: item.master,
						},
					},
					geometry: {
						type: 'Polygon',
						coordinates: [
							getLocationPointsByTopLeft({
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

		getUserLocation();
	};

	map.data.setStyle((feature) => {
		let color = 'gray';
		if (feature.getProperty('color')) {
			color = feature.getProperty('color');
		}
		return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			fillOpacity: 0.2,
			strokeColor: color,
			strokeWeight: 2,
		});
	});

	map.data.addListener('click', (event) => {
		// if (event.feature.getId() === 0) {
		// occupyLocation(event.feature);

		// get short location info
		if (event.feature.getId() === 'highlight' || event.feature.getId() === 'currentLocation') return;


		const getLocationInfoPromise = new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', `/api/locations/${event.feature.getId()}`);
			xhr.send();
			xhr.addEventListener('load', (e) => {
				const getLocationInfoXHR = e.srcElement;

				if (getLocationInfoXHR !== 200) {
					rej(getLocationInfoXHR.response);
				}
				res(getLocationInfoXHR.response);
			});
		});

		// need another SQL-query on server to get valid info (JOIN masters)

		getLocationInfoPromise
			.then((locationData) => {
				console.dir(JSON.parse(locationData));
			})
			.catch((err) => {
				console.log(err);
			});
		// }

		// create custom popup+ get request for info
	//   document.getElementById('info-box').textContent =
	//  event.feature.getProperty('info').name;
	});

	// click on empty location highlights location and shows info about it

	map.addListener('click', (event) => {
		if (map.data.getFeatureById('highlight')) {
			map.data.remove(map.data.getFeatureById('highlight'));
		}

		const topLeftCoords = getTopLeftLocationCoordsByPoint(event.latLng.lat(), event.latLng.lng());
		const lat = topLeftCoords.lat;
		const lng = topLeftCoords.lng;

		// const lat = Math.floor(event.latLng.lat() * 100) / 100;
		// const lng = Math.floor(event.latLng.lng() * 100) / 100;

		clickedInfo.style.display = 'block';
		// clickedCordsInfo.textContent = `${event.latLng.lat()} ${event.latLng.lng()}`;
		clickedLocationInfo.textContent = `${lat} ${lng}`;

		const location = getLocationPointsByTopLeft(topLeftCoords);

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
		clickedLocationHeading.textContent = 'Empty location';
		// setTimeout(() => {
		//   if (!confirm('Поставить поселение?')) {
		//     map.data.remove(map.data.getFeatureById(locationNew.id));
		//     console.log(map.data.getFeatureById(locationNew.id));
		//   }
		//   // here post request for create location
		// }, 1000);
	});


	function getUserLocation() {
		navigator.geolocation.watchPosition((position) => {
			console.dir(position);

			userGeoData = position;

			usersGeocordsInfo.textContent = `${position.coords.latitude} 
																		 ${position.coords.longitude}
																		 ${position.coords.accuracy}`;

			usersLocContainer.style.display = 'block';

			const currentLocationCoords = getTopLeftLocationCoordsByPoint(position.coords.latitude,	position.coords.longitude);
			// const latCurrent = Math.floor(position.coords.latitude * 100) / 100;
			// const lngCurrent = Math.floor(position.coords.longitude * 100) / 100;

			usersLocationInfo.textContent = `${currentLocationCoords.lat} 
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

				// need another SQL-query on server to get valid info (JOIN masters)

			getLocationInfoPromise
				.then((locationData) => {
					console.dir(locationData);
					if (!locationData) {
						createCurrentLocation();
						if (map.data.getFeatureById('currentLocation')) {
							map.data.remove(map.data.getFeatureById('currentLocation'));
						}
					}
				})
				.catch((err) => {
					console.log(err);
				});

			// if location is already created - change bg color only
			// if user go out from location - delete location

			function createCurrentLocation() {
				const location = getLocationPointsByTopLeft(currentLocationCoords);

				// [{
				// 	// north west
				// 	lat: latCurrent,
				// 	lng: lngCurrent,
				// }, {
				// 	// south west
				// 	lat: ((latCurrent * 100) + 1) / 100,
				// 	lng: lngCurrent,
				// }, {
				// 	// south east
				// 	lat: ((latCurrent * 100) + 1) / 100,
				// 	lng: ((lngCurrent * 100) + 1) / 100,
				// }, {
				// 	// north east
				// 	lat: latCurrent,
				// 	lng: ((lngCurrent * 100) + 1) / 100,
				// }];

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
				map.data.add(locationGeoObj);
			}
		});
	}


	function occupyLocation() {
		const createLocatonPromise = new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('POST', 'api/locations');
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify({
				userLat: userGeoData.coords.latitude,
				userLng: userGeoData.coords.longitude,
				accuracy: userGeoData.coords.accuracy,
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
				const thisFeature = map.data.getFeatureById('currentLocation');

				const location = getLocationPointsByTopLeft(response);
				// [{
				// 	// north west
				// 	lat: response.lat,
				// 	lng: response.lng,
				// }, {
				// 	// south west
				// 	lat: ((response.lat * 100) + 1) / 100,
				// 	lng: response.lng,
				// }, {
				// 	// south east
				// 	lat: ((response.lat * 100) + 1) / 100,
				// 	lng: ((response.lng * 100) + 1) / 100,
				// }, {
				// 	// north east
				// 	lat: response.lat,
				// 	lng: ((response.lng * 100) + 1) / 100,
				// }];

				const locationNew = {
					type: 'Feature',
					id: response.locationId,
					properties: {
						color: 'green',
						info: {
						},
					},
					geometry: new google.maps.Data.Polygon([location]),
					// geometry: thisFeature.getGeometry(),
				};
				map.data.add(locationNew);
				// map.data.remove(thisFeature);
			})
			.catch((err) => {
				console.log(err);
			});

		// const locationId = Math.floor((Math.random() * new Date()) / 100000);
		// const locationNew = {
		//   type: 'Feature',
		//   id: 'currentLocation',
		//   properties: {
		//     color: 'blue',
		//     info: {
		//       name: 'Current location',
		//     },
		//   },
		//   geometry: new google.maps.Data.Polygon([location]),
		// };
		// map.data.add(locationNew);
		// map.data.remove(feature);
	}

	let relativeLatSize;
	let relativeLngSize;
	const lngSizeCoefficients = {};
	const latBreakPoints = [];

	initLocationGrid();

	function initLocationGrid(options) {
		options = options || {};
		const preferableLocSideSize = options.preferableLocSideSize || 100;
		const EARTH_EQUATOR_LENGTH = options.EARTH_EQUATOR_LENGTH || 40075696;
		const EARTH_MERIDIAN_LENGTH = options.EARTH_MERIDIAN_LENGTH || 20004274;

		const locSideMetersSizeOn30Lat = preferableLocSideSize;
		const locSideMetersSizeOnEquatorLat = locSideMetersSizeOn30Lat * 1.5;
		const minAbsoluteLatSize = EARTH_MERIDIAN_LENGTH / 1800000000;
		const minAbsoluteLngSize = EARTH_EQUATOR_LENGTH / 3600000000;

		relativeLatSize = getClosestRelSize(Math.round(preferableLocSideSize / minAbsoluteLatSize), 'lat');
		relativeLngSize = getClosestRelSize(Math.round(locSideMetersSizeOnEquatorLat / minAbsoluteLngSize), 'lng');

		let lngPrimeFactorsArr = findPrimeFactors(3600000000 / relativeLngSize);
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
			lngBreakPoint = (Math.floor(Math.round(lngBreakPoint * 10000000) / relativeLatSize) * relativeLatSize) / 10000000;
			lngSizeCoefficients[lngBreakPoint] = lngSizeCoefficient;
			latBreakPoints.push(lngBreakPoint);
		});
		console.dir(lngSizeCoefficients);
	}

	function getTopLeftLocationCoordsByPoint(pointLat, pointLng) {
		const lat = (Math.ceil(Math.round(pointLat * 10000000) /	relativeLatSize) * relativeLatSize) / 10000000;
		const lng = (Math.floor(Math.round(pointLng * 10000000) / getRelLngSize(lat)) * getRelLngSize(lat)) / 10000000;

		return {
			lat,
			lng,
		};
	}

	function getClosestRelSize(preferRelSize, latOrLng) {
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

	function getLocationPointsByTopLeft(topLeftCoords, isForMapArray) {
		if (!isForMapArray) {
			return [{
			// north west
				lat: topLeftCoords.lat,
				lng: topLeftCoords.lng,
			}, {
			// south west
				lat: ((topLeftCoords.lat * 10000000) - relativeLatSize) / 10000000,
				lng: topLeftCoords.lng,
			}, {
			// south east
				lat: ((topLeftCoords.lat * 10000000) - relativeLatSize) / 10000000,
				lng: ((topLeftCoords.lng * 10000000) + getRelLngSize(topLeftCoords.lat)) / 10000000,
			}, {
			// north east
				lat: topLeftCoords.lat,
				lng: ((topLeftCoords.lng * 10000000) + getRelLngSize(topLeftCoords.lat)) / 10000000,
			}];
		}
		return [[
			// north west
			+topLeftCoords.lng,
			+topLeftCoords.lat,
		], [
			// south west
			+topLeftCoords.lng,
			((topLeftCoords.lat * 10000000) - relativeLatSize) / 10000000,
		], [
			// south east
			((topLeftCoords.lng * 10000000) + getRelLngSize(topLeftCoords.lat)) / 10000000,
			((topLeftCoords.lat * 10000000) - relativeLatSize) / 10000000,
		], [
			// north east
			((topLeftCoords.lng * 10000000) + getRelLngSize(topLeftCoords.lat)) / 10000000,
			+topLeftCoords.lat,
		], [
			// north west
			+topLeftCoords.lng,
			+topLeftCoords.lat,
		]];
	}

	function getRelLngSize(topLeftLat) {
		if (topLeftLat < 0) {
			topLeftLat = (topLeftLat - (relativeLatSize / 10000000)) * (-1);
		}

		if (topLeftLat <= latBreakPoints[0]) {
			return relativeLngSize;
		}

		for (let i = 0, maxValue = latBreakPoints.length; i < maxValue; i += 1) {
			if (
				(topLeftLat > latBreakPoints[i] && topLeftLat <= latBreakPoints[i + 1]) ||
				(topLeftLat > latBreakPoints[i] && !latBreakPoints[i + 1])
			) {
				return relativeLngSize * lngSizeCoefficients[latBreakPoints[i]];
			}
		}
	}

	function findPrimeFactors(value) {
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
}
