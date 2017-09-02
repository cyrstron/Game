const EmptyLocation = require('./emptyLocation');

class OccupiedLocation extends EmptyLocation {
	constructor(locationData) {
		super(locationData.northWest);
		this.masterId = locationData.userId;
		this.locationId = locationData.locationId || null;
		this.population = locationData.population || 10;
		this.dailyBank = locationData.dailyBank || 0;
		this.loyalPopulation = locationData.loyalPopulation || 10;
		this.dailyCheckin = locationData.dailyCheckin || true;
		this.creationDate = locationData.creationDate || new Date().toISOString();
	}
	saveLocation() {
		// rewrite with TRANSACTIONS!!!

		return global.db.none(`insert into locations2 (lat, lng,
													 population, daily_bank, creation_date)
						values(
							${this.northWest.lat},
							${this.northWest.lng},
							${this.population},
							${this.dailyBank},
							'${this.creationDate}'
						)`)
			.then(() => global.db.one(`select loc_id from locations2																			 
																 where locations2.lat = ${this.northWest.lat} and locations2.lng = ${this.northWest.lng}`)
			)
			.then((data) => {
				this.locationId = data.loc_id;	
				// -----------------------------
				console.log('Newcoord', this.northWest.lat, this.northWest.lng);				
				
				// ---------------------------------					
				return global.db.none(`insert into master_location2 (user_id, loc_id, loyal_popul, daily_checkin)
															 values(
																 ${this.masterId},
																 ${this.locationId},
																 ${this.loyalPopulation},
																 ${this.dailyCheckin}
															 )`)
					.catch((err) => {
						global.db.none(`delete from locations2
												where loc_id = ${this.locationId}`);
						throw err;
					});
			});


		// return global.db.tx(t => t.batch([
		// 	t.none(`insert into locations2 (loc_id, lat, lng,
		// 		population, daily_bank, creation_date)
		// 				values(
		// 					${this.northWest.lat},
		// 					${this.northWest.lng},
		// 					${this.population},
		// 					${this.dailyBank},
		// 					'${this.creationDate.toISOString()}'
		// 				)`),
		// 	t.none(`insert into master_location2 (user_id, loc_id, loyal_popul, daily_checkin)
		// 					values(
		// 						${this.masterId},
		// 						'${this.locationId}',
		// 						${this.loyalPopulation},
		// 						${this.dailyCheckin}
		// 					)`)
		// ]));
	}

	static deleteAllLocations() {
		global.db.none('delete from locations2');
	}

	static getAllLocations() {
		return global.db.any(`select * from locations2
													 full join master_location2 ON locations2.loc_id = master_location2.loc_id;`)
			.then(locations => new Promise((res) => {
				const occupiedLocations = [];
				locations.forEach((item) => {
					occupiedLocations.push(new OccupiedLocation({
						northWest: {
							lat: item.lat,
							lng: item.lng
						},
						locationId: item.loc_id,
						userId: item.user_id,
						population: item.population,
						dailyBank: item.daily_bank,
						loyalPopulation: item.loyal_pop,
						dailyCheckin: item.daily_checkin,
						creationDate: item.creation_date
					}));
				});
				res(occupiedLocations);
			}));
	}

	static getLocationById(id) {
		return global.db.one(`select * from locations2
						full join master_location2 on locations2.loc_id = master_location2.loc_id
						where locations2.loc_id = $1`, id)
			.then(foundLocation => new Promise((res) => {
				res(new OccupiedLocation({
					northWest: {
						lat: foundLocation.lat,
						lng: foundLocation.lng
					},
					locationId: foundLocation.loc_id,
					userId: foundLocation.user_id,
					population: foundLocation.population,
					dailyBank: foundLocation.daily_bank,
					loyalPopulation: foundLocation.loyal_pop,
					dailyCheckin: foundLocation.daily_checkin,
					creationDate: foundLocation.creation_date
				}));					
			}));
	}

	static checkLocationOnCoords(coords) {
		const location = new EmptyLocation(coords);

		return global.db.oneOrNone(`select * from locations2
						full join master_location2 on locations2.loc_id = master_location2.loc_id
						where locations2.lat = ${location.northWest.lat} and locations2.lng = ${location.northWest.lng}`)
			.then(foundLocation => new Promise((res) => {
				if (!foundLocation) {
					res(location);					
				} else {
					res(new OccupiedLocation({
						northWest: {
							lat: foundLocation.lat,
							lng: foundLocation.lng
						},
						locationId: foundLocation.loc_id,
						userId: foundLocation.user_id,
						population: foundLocation.population,
						dailyBank: foundLocation.daily_bank,
						loyalPopulation: foundLocation.loyal_pop,
						dailyCheckin: foundLocation.daily_checkin,
						creationDate: foundLocation.creation_date

					}));
				}
			}));
	}

	static recalcLocationsLifecycle() {
		global.db.tx(t => t.batch([
			t.none(`delete from locations2
							where loc_id IN (
								select loc_id from master_location2
								where loyal_popul = 0
							);`),
			t.none(`delete from master_location2
							where loyal_popul = 0;`)
		]))
			.then(() => global.db.none(`update locations2
																	set daily_bank = loyal_popul
																	from master_location2
																	where locations2.loc_id = master_location2.loc_id;`))
			.then(() => global.db.none(`update master_location2 
																	set loyal_popul = loyal_popul - ceil(loyal_popul * 0.1)
																	where daily_checkin = false;`))
			.then(() => global.db.none('update master_location2 set daily_checkin = false;'))
			.then(() => {
				console.log('OK');
			})
			.catch((err) => {
				console.log(err.message);
			});
	}

	static restoreLoyalPopulByLocId(id) {
		return global.db.none(`update master_location2
													 set loyal_popul = population
													 from locations2
													 where locations2.loc_id = master_location2.loc_id
													 and locations2.loc_id = '${id}';`);
	}

	static getOwnerByLocId(id) {
		return global.db.oneOrNone(`select user_id from master_location2
													 where loc_id = '${id}';`);
	}
}
module.exports = OccupiedLocation;