const express = require('express');
// const EmptyLocation = require('../models/emptyLocation');
const OccupiedLocation = require('../models/occupiedLocation');

const router = express.Router();

router.get('/', (req, res, next) => {
	OccupiedLocation.getAllLocations()
		.then((locations) => {
			res.status(200)
				.json(locations);
		})
		.catch(err => next(err));
});
router.get('/:id', (req, res, next) => {
	const userId = req.decoded.id;
	const locId = req.params.id;
	let isMaster;
	OccupiedLocation.getOwnerByLocId(locId)
		.then((data) => {
			if (data) {
				isMaster = data.user_id === userId;
			} else {
				isMaster = false;
			}
			return OccupiedLocation.getLocationById(req.params.id);
		})
		.then((location) => {
			if (location) {
				location.isMaster = isMaster;
				res.status(200)
					.json(location);
			} else {
				res.status(200)
					.json({});
			}
		})
		.catch(err => next(err));
});
router.get('/:lat/:lng', (req, res, next) => {
	const coords = {
		lat: req.params.lat,
		lng: req.params.lng,
	};
	const userId = req.decoded.id;
	let isMaster;
	OccupiedLocation.getLocationByCoords(coords)
		.then((data) => {
			if (data) {
				isMaster = data.user_id === userId;
			} else {
				isMaster = false;
			}
			return OccupiedLocation.getLocationById(req.params.id);
		})
		.then((location) => {
			if (location) {
				location.isMaster = isMaster;
				res.status(200)
					.json(location);
			} else {
				res.status(200)
					.json({});
			}
		})
		.catch(err => next(err));
});

router.post('/', (req, res, next) => {
	const userData = {
		userId: req.decoded.id,
		userLng: req.body.userLng,
		userLat: req.body.userLat,
	};
	const newLocation = new OccupiedLocation(userData);
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
