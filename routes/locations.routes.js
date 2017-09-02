const express = require('express');
const EmptyLocation = require('../models/emptyLocation');
const OccupiedLocation = require('../models/occupiedLocation');

const router = express.Router();

router.get('/', (req, res, next) => {
	OccupiedLocation.getAllLocations()
		.then((locations) => {
			res.json(locations);
		})
		.catch(err => next(err));
});
// '/grid?lat=xxx&lng=xxx'
router.get('/grid', (req, res) => {
	const geoData = {
		lat: +req.query.lat,
		lng: +req.query.lng
	};

	const location = new EmptyLocation(geoData);
	res.json(location);
});
// '/check-location?lat=xxx&lng=xxx'
router.get('/check-location', (req, res, next) => {
	const geoData = {
		lat: +req.query.lat,
		lng: +req.query.lng
	};

	OccupiedLocation.checkLocationOnCoords(geoData)
		.then((locationObj) => {
			if (locationObj.masterId === req.decoded.id) {
				Object.assign(locationObj, {
					isMaster: true
				});
			}
			res.json(locationObj);
		})
		.catch((err) => {
			next(err);
		});
});
router.get('/:id', (req, res, next) => {
	const userId = req.decoded.id;
	const locId = +req.params.id;

	OccupiedLocation.getLocationById(locId)
		.then((foundLocation) => {
			if (foundLocation.masterId === userId) {
				Object.assign(foundLocation, {
					isMaster: true
				});
			}
			res.json(foundLocation);
		})
		.catch(err => next(err));
});
// router.get('/:lat/:lng', (req, res, next) => {
// 	const coords = {
// 		lat: req.params.lat,
// 		lng: req.params.lng
// 	};
// 	const userId = req.decoded.id;
// 	let isMaster;
// 	OccupiedLocation.getLocationByCoords(coords)
// 		.then((data) => {
// 			if (data) {
// 				isMaster = data.user_id === userId;
// 			} else {
// 				isMaster = false;
// 			}
// 			return OccupiedLocation.getLocationById(req.params.id);
// 		})
// 		.then((location) => {
// 			if (location) {
// 				location.isMaster = isMaster;
// 				res.status(200)
// 					.json(location);
// 			} else {
// 				res.status(200)
// 					.json({});
// 			}
// 		})
// 		.catch(err => next(err));
// });

router.post('/', (req, res, next) => {
	const newLocationData = Object.assign({
		userId: req.decoded.id
	}, req.body);
	const newLocation = new OccupiedLocation(newLocationData);
	newLocation.saveLocation()
		.then(() => {
			res.json(newLocation);
		})
		.catch(err => next(err));
});
router.put('/:id/restore-population', (req, res, next) => {
	const userId = req.decoded.id;
	const locId = req.params.id;
	OccupiedLocation.getOwnerByLocId(locId)
		.then((data) => {
			if (data.user_id !== userId) {
				throw new Error('Permission denied!');
			}
			return OccupiedLocation.restoreLoyalPopulByLocId(locId);
		})
		.then(() => {
			res.sendStatus(200);
		})
		.catch((err) => {
			next(err);
		});
});

module.exports = router;
