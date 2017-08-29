'use strict';

window.onload = function () {
	const map = document.getElementById('world-map');
	const clickedInfo = document.getElementById('output');
	const usersLocContainer = document.getElementById('current-loc-info');
	const clickedCordsInfo = document.getElementById('click-geocords');
	const clickedLocationInfo = document.getElementById('click-location');
	const usersGeocordsInfo = document.getElementById('users-geocords');
	const usersLocationInfo = document.getElementById('users-location');
	const locHighlight = document.getElementById('loc-highlight');
	const currLocHightlight = document.getElementById('curr-loc-highlight');
	const occupyBtn = document.getElementById('occupy-btn');

	let currentLocCords;

	map.addEventListener('click', getClickedLocation);
	occupyBtn.addEventListener('click', occupyLocation);

	getUserLocation();

	// handler for retrieving location information by click. test version.

	function getClickedLocation(event) {
		const coordX = event.clientX;
		const coordY = event.clientY;
		const clickedLocCords = getLocationCords(coordX, coordY, true);

		highlightClickedLocation(clickedLocCords);

		clickedInfo.style.display = 'block';
		clickedCordsInfo.textContent = `${clickedLocCords.relX} ${clickedLocCords.relY}`;
		clickedLocationInfo.textContent = `${clickedLocCords.locX} ${clickedLocCords.locY}`;
	}


	// handler for retrieving current location information. test version.

	function getUserLocation() {
		navigator.geolocation.watchPosition((position) => {
			usersGeocordsInfo.textContent = `${position.coords.latitude} 
																			 ${position.coords.longitude}
																			 ${position.coords.accuracy}`;

			currentLocCords = getLocationCords(position.coords.longitude, position.coords.latitude);

			usersLocationInfo.textContent = `${currentLocCords.locX} 
																			 ${currentLocCords.locY}`;

			highlightCurrentLocation(currentLocCords);
			usersLocContainer.style.display = 'block';
			// and send currentLocCords to server with websocket.
		});
	}

	// function for retrieving location coordonates by geopoint

	function getLocationCords(relX, relY, isMouseClick) {
		const relWidth = 36;
		const relHeight = 18;

		if (isMouseClick) {
			const mapCords = map.getBoundingClientRect();
			const mapWidth = map.offsetWidth;
			const mapHeight = map.offsetHeight;

			relX = recalcLong(relX - mapCords.left, mapWidth);
			relY = recalcLat(relY - mapCords.top, mapHeight);
		}

		let locX = (relX % relWidth) > (relWidth / 2) ?
			(Math.ceil(relX / relWidth) - 0.5) * relWidth :
			(Math.floor(relX / relWidth) + 0.5) * relWidth;
		let locY = (relY % relHeight) > (relHeight / 2) ?
			(Math.ceil(relY / relHeight) - 0.5) * relHeight :
			(Math.floor(relY / relHeight) + 0.5) * relHeight;

		if (locX > 180) {
			locX -= relWidth;
		}

		if (locY > 90) {
			locY -= relHeight;
		}

		return {
			locX,
			locY,
			relX,
			relY,
		};
	}

	// function for recalculating pixels to map coordinates

	function recalcLong(coord, size) {
		return Math.round((coord / size) * 360) - 180;
	}
	function recalcLat(coord, size) {
		return Math.round((coord / size) * -180) + 90;
	}

	function highlightCurrentLocation(cords) {
		const highlightCords = getHighlightCords(cords);

		currLocHightlight.style.display = 'block';
		currLocHightlight.style.top = `${highlightCords.top}%`;
		currLocHightlight.style.left = `${highlightCords.left}%`;
	}

	function highlightClickedLocation(cords) {
		const highlightCords = getHighlightCords(cords);

		locHighlight.style.display = 'block';
		locHighlight.style.top = `${highlightCords.top}%`;
		locHighlight.style.left = `${highlightCords.left}%`;
	}

	function getHighlightCords(cords) {
		const top = Math.floor(((cords.locY - 81) / -180) * 100);
		const left = Math.floor(((cords.locX + 162) / 360) * 100);

		return {
			top,
			left,
		};
	}

	function occupyLocation() {
		alert('Congrats!');
		currLocHightlight.style.backgroundColor = 'rgba(0, 100, 0, 0.5)';
		const promise = new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', '/api/locations/create', true);
			console.log(JSON.stringify(currentLocCords));
			xhr.send(JSON.stringify(currentLocCords));
			xhr.onload = function () {
				if (this.status === 200) {
					resolve(this.response);
				} else {
					const error = new Error(this.statusText);
					error.code = this.status;
					reject(error);
				}
			};
		});

		promise
			.then(() => {
				alert('Congrats!');
			})
			.catch((err) => {
				alert(err.message);
			});
	}
};
