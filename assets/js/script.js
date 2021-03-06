'use strict';

class Game {
	constructor(options) {
		// use template for output
		options = options || {};

		this.locInfoContainer = options.locInfoContainer || document.getElementById('loc-info');
		this.clickedLocInfo = options.locInfoContainer || document.getElementById('clicked-loc-info');
		this.currentLocInfo = options.locInfoContainer || document.getElementById('current-loc-info');
		this.occupFormContainer = options.locInfoContainer || document.getElementById('occup-form');

		this.occLocRenderedEvent = new CustomEvent('occloc-ready', {
			bubbles: true
		});
		this.occupyBtn = document.getElementById('occupy-btn');
		this.userMarker = null;
		this.map = options.map || null;
		this.mapBounds = options.mapBounds || null;
		this.userGeoData = null;
		this.currentLocation = null;
		this.currentLocationMapFeature = null;
		this.highlightedLocation = null;
		this.highlightedMapFeature = null;
		this.occupiedLocationsArray = null;
		this.mapFeaturesArray = [];

		this.locInfoContainer.addEventListener('click', (event) => {
			let target = event.target;

			if (target.closest('#btn-hide')) {
				target = target.closest('#btn-hide');
				// hide #loc-info
				return;
			}
			if (target.closest('#close-btn')) {
				target = target.closest('#close-btn');
				// close #clicked-loc-info
				return;
			}
			if (target.closest('#occupy-btn')) {
				target = target.closest('#occupy-btn');
				this.showOccupationForm();
				return;
			}
			if (target.closest('#edit-loc-btn')) {
				target = target.closest('#edit-loc-btn');
				// this.showEditingLocForm();
				return;
			}
			if (target.closest('#money-btn')) {
				target = target.closest('#money-btn');
				this.takeDailyBank();
				return;
			}
			if (target.closest('#feed-btn')) {
				target = target.closest('#feed-btn');
				this.restorePopulation();
			}
		});
		this.locInfoContainer.addEventListener('submit', (event) => {
			const form = event.target;
			if (form.getAttribute('name') === 'occup-form') {
				this.occupySubmitHandler(event);
			}

			if (form.getAttribute('name') === 'edit-loc-form') {
				this.editLocationInfoHandler(event);
			}
		});
	}

	// FEATURE CREATING METHODS	

	getAndRenderLocByFeatureCoords(location) {
		const properties = this.getMapFeatureProperties(location);

		const locationGeoObj = {
			type: 'Feature',
			id: location.locationId,
			properties,
			geometry: new google.maps.Data.Polygon([location.mapFeatureCoords])
		};
		return this.map.data.add(locationGeoObj);
	}

	get mapFeaturesStyles() {
		return {
			defaultStyles: {
				strokeColor: 'gray',
				fillColor: 'transparent',
				fillOpacity: 0.2,
				strokeWeight: 1,
				strokeOpacity: 1
			},
			ownedLocation: {
				fillColor: 'green'
			},
			occupiedLocation: {
				fillColor: 'gray'
			},
			profitLocation: {
				strokeColor: 'orange',
				strokeWeight: 3
			},
			highlightedEmptyLocation: {
				strokeColor: 'blue'
			},
			currentLocation: {
				strokeColor: 'crimson'
			}
		};
	}

	getMapFeatureProperties(location) {
		let featureProperties = this.mapFeaturesStyles.defaultStyles;
		featureProperties.info = {};
		featureProperties.info.isHighlighted = location.isHighlighted;
		featureProperties.info.isCurrent = location.isCurrent;

		if (location.masterId) {
			if (location.isMaster) {
				featureProperties = Object.assign(
					featureProperties,
					this.mapFeaturesStyles.ownedLocation
				);
				if (location.dailyBank !== 0) {
					featureProperties = Object.assign(
						featureProperties,
						this.mapFeaturesStyles.profitLocation
					);
				}
			} else {
				featureProperties = Object.assign(
					featureProperties,
					this.mapFeaturesStyles.occupiedLocation
				);
			}
			featureProperties.info.name = location.locationName;
			featureProperties.info.population = location.population;
			featureProperties.info.masterId = location.masterId;
		} else {
			featureProperties.info.name = 'Empty location';
		}

		if (location.isCurrent) {
			featureProperties = Object.assign(
				featureProperties,
				this.mapFeaturesStyles.currentLocation
			);
		}
		if (location.isHighlighted) {
			featureProperties = Object.assign(
				featureProperties,
				this.mapFeaturesStyles.highlightedEmptyLocation
			);
		}

		return featureProperties;
	}

	// GET LOCATIONS INFO FROM DB METHODS	

	// get ALL occupied locations short info from db
	getOccupiedLocations() {
		return new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', '/api/locations/');
			xhr.send();
			xhr.addEventListener('load', (e) => {
				const srcXHR = e.target;
				if (srcXHR.status === 200) {
					res(JSON.parse(srcXHR.response));
				} else {
					rej(srcXHR.response);
				}
			});
		})
			.then(locArray => new Promise((res) => {
				this.occupiedLocationsArray = locArray;
				res();
			}));
	}

	// get current location info (returns empty or occupied locations on the current point)

	getCurrentLocation() {
		const geoCoords = {
			lat: this.userGeoData.latitude,
			lng: this.userGeoData.longitude
		};
		return new Promise((res, rej) => {
			const gridXHR = new XMLHttpRequest();
			gridXHR.open('GET', `/api/locations/check-location?lat=${geoCoords.lat}&lng=${geoCoords.lng}`);
			gridXHR.send();
			gridXHR.onload = (e) => {
				const xhr = e.srcElement;
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(JSON.parse(xhr.response));
			};
		});
	}

	getLocationInfoById(id) {
		return new Promise((res, rej) => {
			const xhr = new XMLHttpRequest();

			xhr.open('GET', `/api/locations/${id}`);
			xhr.send();
			xhr.addEventListener('load', (e) => {
				const getLocationInfoXHR = e.srcElement;

				if (getLocationInfoXHR.status !== 200) {
					rej(getLocationInfoXHR.response);
				}
				res(JSON.parse(getLocationInfoXHR.response));
			});
		});
	}

	// get empty location coords from chosen point

	getGridByGeoCoords(geoCoords) {
		return new Promise((res, rej) => {
			const gridXHR = new XMLHttpRequest();
			gridXHR.open('GET', `/api/locations/grid?lat=${geoCoords.lat}&lng=${geoCoords.lng}`);
			gridXHR.send();
			gridXHR.onload = (e) => {
				const xhr = e.srcElement;
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(JSON.parse(xhr.response));
			};
		});
	}

	// RENDERING OF ALL OCCUPIED LOCATIONS

	renderOccupiedLocations() {
		this.getOccupiedLocations()
			.then(() => {
				this.occupiedLocationsArray.forEach((location) => {
					const mapFeature = this.getAndRenderLocByFeatureCoords(location);
					this.mapFeaturesArray.push(mapFeature);
				});

				document.dispatchEvent(this.occLocRenderedEvent);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	// CURRENT LOCATION RENDER METHODS

	renderCurrentLocationInfo() {
		this.getCurrentLocation()
			.then((currentLocation) => {
				console.log(currentLocation);
				this.removeCurrentHighlight();
				if (!currentLocation.masterId) {
					currentLocation.locationName = 'Empty Location';
					this.renderCurrentEmptyLocation(currentLocation);
				} else {
					this.renderCurrentOccupiedLocation(currentLocation);
				}
				this.renderCurrentLocationTextInfo();
				if (this.currentLocation.isMaster && !this.currentLocation.dailyCheckin) {
					this.doCheckin()
						.then(() => {
							this.currentLocation.dailyCheckin = true;
							console.log(`You checked in location #${this.currentLocation.locationId}`);
						})
						.catch((err) => {
							console.log(err);
						});
				}
			});
	}

	renderCurrentOccupiedLocation(currentLocation) {
		this.currentLocation = this.getAndExtendLoadedLocationById(currentLocation);
		this.currentLocation.isCurrent = true;
		this.currentLocationMapFeature = this.getAndRenderLocByFeatureCoords(
			this.currentLocation
		);
	}

	renderCurrentEmptyLocation(currentLocation) {
		this.currentLocation = currentLocation;
		this.currentLocation.isCurrent = true;
		this.currentLocationMapFeature = this.getAndRenderLocByFeatureCoords(
			this.currentLocation
		);
	}

	removeCurrentHighlight() {
		if (this.currentLocationMapFeature) {
			const currentLocId = this.currentLocationMapFeature.getId();
			if (currentLocId || this.currentLocationMapFeature.getProperty('info').isHighlighted) {
				this.currentLocation.isCurrent = undefined;
				const featureProps = this.getMapFeatureProperties(this.currentLocation);
				this.map.data.overrideStyle(
					this.currentLocationMapFeature,
					featureProps
				);
				this.currentLocationMapFeature.setProperty('info', featureProps.info);
			} else {
				this.map.data.remove(this.currentLocationMapFeature);
			}
		}
	}

	renderCurrentLocationTextInfo() {
		if (this.locInfoContainer.className === 'loc-info') {
			this.locInfoContainer.classList.add('show-current');
		}
		this.currentLocInfo.innerHTML = this.getLocInfoHTML(this.currentLocation);
	}

	// HIGHLIGHTED LOCATION METHODS

	// occupied locations highlighting methods

	renderOccupiedLocationInfo(targetFeatureId) {
		this.getLocationInfoById(targetFeatureId)
			.then((clickedLocation) => {
				console.log(clickedLocation);
				this.highlightOccupiedLocation(clickedLocation);
				this.renderHighlightedLocationTextInfo();
			});
	}

	highlightOccupiedLocation(clickedLocation) {
		this.removeHighlight();

		const locId = clickedLocation.locationId;

		this.highlightedMapFeature = this.map.data.getFeatureById(locId);
		this.highlightedLocation = this.getAndExtendLoadedLocationById(clickedLocation);
		this.highlightedLocation.isHighlighted = true;
		const featureProps = this.getMapFeatureProperties(this.highlightedLocation);
		this.map.data.overrideStyle(
			this.highlightedMapFeature,
			featureProps
		);
		this.highlightedMapFeature.setProperty('info', featureProps.info);
	}

	// current location highlighting method

	hightlightCurrentEmptyLocation() {
		this.removeHighlight();
		this.currentLocation.isHighlighted = true;
		this.highlightedLocation = this.currentLocation;
		this.highlightedMapFeature = this.currentLocationMapFeature;
		const featureProps = this.getMapFeatureProperties(this.currentLocation);
		this.map.data.overrideStyle(
			this.currentLocationMapFeature,
			featureProps
		);
		this.currentLocationMapFeature.setProperty('info', featureProps.info);
	}

	// empty locations highlighting methods

	renderEmptyLocationInfo(event) {
		this.getGridByGeoCoords({
			lat: event.latLng.lat(),
			lng: event.latLng.lng()
		})
			.then((clickedLocation) => {
				console.log(clickedLocation);
				clickedLocation.locationName = 'Empty Location';
				this.highlightEmptyLocation(clickedLocation);
				this.renderHighlightedLocationTextInfo();
			});
	}

	highlightEmptyLocation(clickedLocation) {
		this.removeHighlight();
		this.highlightedLocation = clickedLocation;
		clickedLocation.isHighlighted = true;
		this.highlightedMapFeature = this.getAndRenderLocByFeatureCoords(
			clickedLocation
		);
	}

	removeHighlight() {
		if (this.highlightedMapFeature) {
			const highlightedLocId = this.highlightedMapFeature.getId();
			if (highlightedLocId || this.highlightedMapFeature.getProperty('info').isCurrent) {
				this.highlightedLocation.isHighlighted = undefined;
				const featureProps = this.getMapFeatureProperties(this.highlightedLocation);
				this.map.data.overrideStyle(
					this.highlightedMapFeature,
					featureProps
				);
				this.highlightedMapFeature.setProperty('info', featureProps.info);
			} else {
				this.map.data.remove(this.highlightedMapFeature);
			}
		}
	}

	renderHighlightedLocationTextInfo() {
		this.locInfoContainer.className = 'loc-info';
		this.locInfoContainer.classList.add('show-clicked');
		this.clickedLocInfo.innerHTML = this.getLocInfoHTML(this.highlightedLocation);
	}

	// SEARCH LOCATION IN LOADED LOCATIONS ARRAY AND UPDATE

	getAndExtendLoadedLocationById(newLocData) {
		let location;
		this.occupiedLocationsArray.forEach((item) => {
			if (item.locationId === newLocData.locationId) {
				location = Object.assign(item, newLocData);
			}
		});
		return location;
	}

	// LOCATION INTERACTION METHODS	

	showOccupationForm() {
		this.locInfoContainer.className = 'loc-info';
		this.locInfoContainer.classList.add('show-form');
		this.occupFormContainer.innerHTML = this.getLocOccupFormHTML();
	}

	occupySubmitHandler(event) {
		event.preventDefault();
		const form = event.target;
		const locName = form['location-name'].value;
		const dailyMsg = form['daily-msg'].value;

		this.currentLocation.locationName = locName;
		this.currentLocation.dailyMessage = dailyMsg;

		this.occupyCurrentLocation();
	}

	// occupyResetHandler(event) {
	// 	event.preventDefault();
	// 	const form = event.target;
	// 	const locName = form['location-name'].value;
	// 	const dailyMsg = form['daily-msg'].value;

	// 	this.currentLocation.locationName = locName;
	// 	this.currentLocation.dailyMessage = dailyMsg;

	// 	this.occupyCurrentLocation();
	// }

	occupyCurrentLocation() {
		this.occupyLocation(this.currentLocation)
			.then((newLocation) => {
				this.occupiedLocationsArray.push(newLocation);
				this.renderCurrentOccupiedLocation(newLocation);
				this.renderCurrentLocationTextInfo();
				this.hideOccupationForm();
			})
			.catch((err) => {
				console.log(err);
			});
	}

	occupyLocation(location) {
		return new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('POST', 'api/locations/create');
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify(location));
			createLocationXHR.addEventListener('load', (e) => {
				const xhr = e.srcElement;
				console.log(xhr);
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(JSON.parse(xhr.response));
			});
		});
	}

	// showEditingLocForm() {
	// 	this.locInfoContainer.className = 'loc-info';
	// 	this.locInfoContainer.classList.add('show-form');
	// 	this.occupFormContainer.innerHTML = this.getLocOccupFormHTML(
	// 		this.highlightedLocation || this.currentLocation
	// 	);
	// }

	// editLocationInfoHandler(event) {
	// 	event.preventDefault();
	// 	const form = event.target;
	// 	const locName = form['location-name'].value;
	// 	const dailyMsg = form['daily-msg'].value;
	// 	const location = form['daily-msg'].value;

	// 	this.currentLocation.locationName = locName;
	// 	this.currentLocation.dailyMessage = dailyMsg;

	// 	this.occupyCurrentLocation();
	// }

	hideOccupationForm() {
		const locInfoClass = this.highlightedLocation ? 'show-clicked' : 'show-current';
		this.locInfoContainer.className = 'loc-info';
		this.locInfoContainer.classList.add(locInfoClass);
		this.occupFormContainer.innerHTML = '';
	}

	restorePopulation() {
		return new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('PUT', `api/locations/${this.highlightedLocation.locationId}/restore-population`);
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send();
			createLocationXHR.onload = (e) => {
				const xhr = e.srcElement;
				console.log(xhr);
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(xhr.response);
			};
		})
			.then(() => {
				this.highlightedLocation.loyalPopulation = this.highlightedLocation.population;
				this.renderHighlightedLocationTextInfo();
				this.highlightOccupiedLocation(this.highlightedLocation);
				console.log(`Congrats! You saved your mouse in location location ${this.highlightedLocation.locationId}!`);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	doCheckin() {
		return new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('PUT', `api/locations/${this.currentLocation.locationId}/do-checkin`);
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify({
				userGeoData: {
					lat: this.userGeoData.latitude,
					lng: this.userGeoData.longitude
				}
			}));
			createLocationXHR.onload = (e) => {
				const xhr = e.srcElement;
				console.log(xhr);
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(xhr.response);
			};
		});
	}

	takeDailyBank() {
		return new Promise((res, rej) => {
			const createLocationXHR = new XMLHttpRequest();
			createLocationXHR.open('PUT', `api/locations/${this.currentLocation.locationId}/get-bank`);
			createLocationXHR.setRequestHeader('Content-Type', 'application/json');
			createLocationXHR.send(JSON.stringify({
				userGeoData: {
					lat: this.userGeoData.latitude,
					lng: this.userGeoData.longitude
				}
			}));
			createLocationXHR.onload = (e) => {
				const xhr = e.srcElement;
				console.log(xhr);
				if (xhr.status !== 200) {
					rej(xhr.response);
				}
				res(xhr.response);
			};
		})
			.then(() => {
				this.currentLocation.dailyBank = 0;
				this.renderCurrentOccupiedLocation(this.currentLocation);
				this.renderCurrentLocationTextInfo();
			})
			.catch((err) => {
				console.log(err);
			});
	}

	// TEMPLATES

	getLocOccupFormHTML(location) {
		return `
			<form name="${location ? 'edit-loc-form' : 'occup-form'}"${location ? ` data-editing-loc-id="${location.locationId}"` : ''}>
				<div>
					<label for="location-name">Location name:<label>			
					<input type="name" name="location-name" id="loc-name-field" value="${location ? location.locationName : ''}" required>				
				</div>
				<div>
					<label for="daily-msg-field">Daily message:<label>		
					<textarea name="daily-msg" id="daily-msg-field">${location ? location.dailyMessage : ''}</textarea>
				</div>			
				<div>
					<input type="submit" value="Occupy">				
					<input type="reset" value="Cancel">
				</div>
			</form>
		`;
	}

	getLocInfoHTML(location) {
		return `
			${location.isHighlighted ? '<button class="close-btn" id="close-btn">X</button>' : ''}
      <div>
				<h2 class="info-heading">${location.locationName}${location.masterName ? ` (${location.masterName})` : ''}</h2>							
				${location.dailyMessage ? `<span>${location.dailyMessage}</span>` : ''}													
				${location.isMaster ? `<span>Loyalty: ${location.loyalPopulation}/${location.population}</span>` : ''}
				${location.dailyBank !== undefined ? `<span>Bank: ${location.dailyBank}</span>` : ''}
				${!location.isMaster && location.population ? `<span>Population: ${location.population}</span>` : ''}
				<span>Location coords: ${location.northWest.lat} ${location.northWest.lng}</span>
			</div>
			${!location.masterId && location.isCurrent ? '<button class="occupy-btn" id="occupy-btn">Occupy</button>' : ''}
			${location.isMaster ? '<button class="edit-loc-btn" id="edit-loc-btn">Edit location</button>' : ''}
			${location.isMaster && location.isCurrent && location.dailyBank ? '<button class="money-btn" id="money-btn">Take money</button>' : ''}
			${location.isMaster && !location.isCurrent && location.loyalPopulation < location.population ? '<button class="feed-btn" id="feed-btn">Feed</button>' : ''}
    `;
	}

	// GOOGLE MAP AND HTML5 GEOLOCATION INTERACTION METHODS

	centerMapByUserGeoData() {
		const lat = this.userGeoData.latitude;
		const lng = this.userGeoData.longitude;
		this.map.setZoom(15);
		this.map.setCenter({ lat, lng });
	}

	renderCurrentUserMarker() {
		if (this.userMarker) {
			this.userMarker.setMap(null);
		}
		this.userMarker = new google.maps.Marker({
			position: {
				lat: this.userGeoData.latitude,
				lng: this.userGeoData.longitude
			},
			map: this.map,
			title: 'There you are!'
		});
	}

	updateMapBounds() {
		this.setMapBounds({
			northEast: {
				lat: this.map.getBounds().getNorthEast().lat(),
				lng: this.map.getBounds().getNorthEast().lng()
			},
			southWest: {
				lat: this.map.getBounds().getSouthWest().lat(),
				lng: this.map.getBounds().getSouthWest().lng()
			}
		});
	}

	setMapBounds(mapBounds) {
		this.mapBounds = mapBounds;
	}

	setUserGeoData(userCoord) {
		this.userGeoData = userCoord;
	}
}

function initMap() {
	const map = new google.maps.Map(document.getElementById('map'), {
		zoom: 12,
		center: { lat: 49.9891, lng: 36.2322 },
		clickableIcons: false
	});


	window.onload = function () {
		const game = new Game({
			map,
			mapBounds: {
				northEast: {
					lat: map.getBounds().getNorthEast().lat(),
					lng: map.getBounds().getNorthEast().lng()
				},
				southWest: {
					lat: map.getBounds().getSouthWest().lat(),
					lng: map.getBounds().getSouthWest().lng()
				}
			}
		});


		map.data.setStyle((feature) => {
			const defaultStyles = game.mapFeaturesStyles.defaultStyles;
			const strokeColor = feature.getProperty('strokeColor') || defaultStyles.strokeColor;
			const fillColor = feature.getProperty('fillColor') || defaultStyles.fillColor;
			const fillOpacity = feature.getProperty('fillOpacity') || defaultStyles.fillOpacity;
			const strokeWeight = feature.getProperty('strokeWeight') || defaultStyles.strokeWeight;
			const strokeOpacity = feature.getProperty('strokeOpacity') || defaultStyles.strokeOpacity;
			return /** @type {google.maps.Data.StyleOptions} */({
				fillColor,
				fillOpacity,
				strokeColor,
				strokeWeight,
				strokeOpacity
			});
		});

		document.addEventListener('occloc-ready', initMapInteraction);

		game.renderOccupiedLocations();

		function initMapInteraction() {
			navigator.geolocation.getCurrentPosition((position) => {
				game.map.setZoom(16);
				game.map.setCenter({
					lat: position.coords.latitude,
					lng: position.coords.longitude
				});
			}, () => {
				// THERE HAVE TO BE CODE FOR TURNED OFF GEOLOCATION NOTIFICATION
				alert('Your geolocation is not working. Probably you forgot to turn it on. Please, turn on geolocation and give proper access to this app');
			});

			navigator.geolocation.watchPosition((position) => {
				game.setUserGeoData(position.coords);
				game.renderCurrentLocationInfo();
				game.renderCurrentUserMarker();
			});

			map.addListener('click', (event) => {
				game.renderEmptyLocationInfo(event);
			});

			map.data.addListener('click', (event) => {
				if (event.feature.getProperty('info').isHighlighted) return;

				const targetFeatureId = event.feature.getId();

				if (targetFeatureId) {
					game.renderOccupiedLocationInfo(targetFeatureId);
					return;
				}
				if (event.feature.getProperty('info').isCurrent) {
					game.hightlightCurrentEmptyLocation();
				}
			});
			document.removeEventListener('occloc-ready', initMapInteraction);
		}
	};
}
