const EmptyLocation = require('./emptyLocation');

class OccupiedLocation extends EmptyLocation {
	constructor(userData) {
		super(userData);
		this.masterId = userData.userId;
		this.population = 10;
		this.dailyBank = 0;
		this.loyalPopulation = 1;
		this.dailyCheckin = true;
		this.creationDate = new Date();
	}
	saveLocation() {
	// ESLint deleted curly braces. Not sure if it is OK

		return global.db.tx(t => t.batch([
			t.none(`insert into locations (loc_id, lat, lng,
				population, daily_bank, creation_date)
						values(
							'${this.locationId}',
							${this.lat},
							${this.lng},
							${this.population},
							${this.dailyBank},
							'${this.creationDate.toISOString()}'
						)`),
			t.none(`insert into master_location (user_id, loc_id, loyal_popul, daily_checkin)
							values(
								${this.masterId},
								'${this.locationId}',
								${this.loyalPopulation},
								${this.dailyCheckin}
							)`),
		]))
			.then((data) => {
				console.log(data);
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static deleteAllLocations() {
		global.db.none('delete from location');
	}

	static getAllLocations() {
		return global.db.any(`select locations.loc_id AS loc_id, lat, lng, user_id from locations
									 full join master_location ON locations.loc_id = master_location.loc_id;`);
	}

	static getLocationById(id) {
		const queryResult = global.db.oneOrNone(`select locations.loc_id AS loc_id, lat, lng, user_id from locations
						full join master_location on locations.loc_id = master_location.loc_id
						where locations.loc_id = $1`, id);
		// console.log(queryResult);
		if (!queryResult) {
			return [];
		}
		return queryResult;
	}

	static getLocationByCoords(coords) {
		const queryResult = global.db.oneOrNone(`select locations.loc_id AS loc_id, lat, lng, user_id from locations
						full join master_location on locations.loc_id = master_location.loc_id
						where locations.lat = ${coords.lat}, locations.lng = ${coords.lng}`, coords);
		if (!queryResult) {
			return [];
		}
		return queryResult;
	}
	static recalcLocationsLifecycle() {
		global.db.tx(t => t.batch([
			t.none(`delete from locations
							where loc_id IN (
								select loc_id from master_location
								where loyal_popul = 0
							);`),
			t.none(`delete from master_location
							where loyal_popul = 0;`),
		]))
			.then(() => global.db.none(`update locations
																	set daily_bank = loyal_popul
																	from master_location
																	where locations.loc_id = master_location.loc_id;`))
			.then(() => global.db.none(`update master_location 
																	set loyal_popul = loyal_popul - ceil(loyal_popul * 0.1)
																	where daily_checkin = false;`))
			.then(() => global.db.none('update master_location set daily_checkin = false;'))
			.then(() => {
				console.log('OK');
			})
			.catch((err) => {
				console.log(err.message);
			});
	}

	static restoreLoyalPopulByLocId(id) {
		return global.db.none(`update master_location
													 set loyal_popul = population
													 from locations
													 where locations.loc_id = master_location.loc_id
													 and locations.loc_id = '${id}';`);
	}

	static getOwnerByLocId(id) {
		return global.db.oneOrNone(`select user_id from master_location
													 where loc_id = '${id}';`);
	}
}
module.exports = OccupiedLocation;
