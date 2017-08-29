class EmptyLocation {
	constructor(userData) {
		this.lat = this.getTopLeftLocationCoordsByPoint({
			lat: userData.userLat,
			lng: userData.userLng,
		}).lat;
		this.lng = this.getTopLeftLocationCoordsByPoint({
			lat: userData.userLat,
			lng: userData.userLng,
		}).lng;
	}

	set locationId(locId) {
		this.locationId = `${this.lat}${this.lng}`;
	}

	// location grid methods

	static initLocationGrid(options) {
		options = options || {};

		EmptyLocation.prototype.EQUATOR_LENGTH = options.EQUATOR_LENGTH || 40075696;
		EmptyLocation.prototype.MERIDIAN_LENGTH = options.MERIDIAN_LENGTH || 20004274;
		EmptyLocation.prototype.preferableLocSideSize = options.preferableLocSideSize || 100;

		EmptyLocation.prototype.locSideMetersSizeOnEquatorLat = this.prototype.preferableLocSideSize * 1.5;

		const minAbsoluteLatSize = this.prototype.MERIDIAN_LENGTH / 1800000000;
		const minAbsoluteLngSize = this.prototype.EQUATOR_LENGTH / 3600000000;

		EmptyLocation.prototype.relativeLatSize = this.getClosestRelSize(
			Math.round(this.prototype.preferableLocSideSize / minAbsoluteLatSize),
			'lat');
		EmptyLocation.prototype.relativeLngSize = this.getClosestRelSize(
			Math.round(this.prototype.locSideMetersSizeOnEquatorLat / minAbsoluteLngSize),
			'lng');

		EmptyLocation.prototype.lngSizeCoefficients = {};
		EmptyLocation.prototype.latBreakPoints = [];

		let lngPrimeFactorsArr = this.findPrimeFactors(3600000000 / this.prototype.relativeLngSize);
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
			lngBreakPoint = (
				Math.floor(Math.round(lngBreakPoint * 10000000) / EmptyLocation.prototype.relativeLatSize) *
				EmptyLocation.prototype.relativeLatSize) /
				10000000;
			EmptyLocation.prototype.lngSizeCoefficients[lngBreakPoint] = lngSizeCoefficient;
			EmptyLocation.prototype.latBreakPoints.push(lngBreakPoint);
		});
	}

	static getClosestRelSize(preferRelSize, latOrLng) {
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

	static findPrimeFactors(value) {
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

	getTopLeftLocationCoordsByPoint(point) {
		const lat = (Math.ceil(Math.round(point.lat * 10000000) /
								this.relativeLatSize) * this.relativeLatSize) /
								10000000;
		const lng = (Math.floor(Math.round(point.lng * 10000000) /
								this.getRelLngSize(this.lat)) * this.getRelLngSize(this.lat)) /
								10000000;

		return {
			lat,
			lng,
		};
	}

	getRelLngSize() {
		let result;

		if (this.lat < 0) {
			this.lat = (this.lat - (this.relativeLatSize / 10000000)) * (-1);
		}

		if (this.lat <= this.latBreakPoints[0]) {
			return this.relativeLngSize;
		}

		for (let i = 0, maxValue = this.latBreakPoints.length; i < maxValue; i += 1) {
			if (
				(this.lat > this.latBreakPoints[i] && this.lat <= this.latBreakPoints[i + 1]) ||
			(this.lat > this.latBreakPoints[i] && !this.latBreakPoints[i + 1])
			) {
				result = this.relativeLngSize * this.lngSizeCoefficients[this.latBreakPoints[i]];
			}
		}

		return result;
	}

	getLocationPointsByTopLeft() {
		return [{
			// north west
			lat: this.lat,
			lng: this.lng,
		}, {
			// south west
			lat: ((this.lat * 10000000) - this.relativeLatSize) / 10000000,
			lng: this.lng,
		}, {
			// south east
			lat: ((this.lat * 10000000) - this.relativeLatSize) / 10000000,
			lng: ((this.lng * 10000000) + this.getRelLngSize(this.lat)) / 10000000,
		}, {
			// north east
			lat: this.lat,
			lng: ((this.lng * 10000000) + this.getRelLngSize(this.lat)) / 10000000,
		}];
	}
}

EmptyLocation.initLocationGrid();

module.exports = EmptyLocation;
