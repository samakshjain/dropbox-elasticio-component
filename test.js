var Q = require("q");
var request = require("request-promise");

function getFolders(){
	var options = {
		method: 'POST',
		headers: {
			Authorization: 'Bearer 1LmuanYhz_IAAAAAAAAvVffzbjEDiB6riYQ5kWodkVMI2LnuEC2vKJ8dpags027H',
		},
		uri: 'https://api.dropboxapi.com/2/files/list_folder',
		json: true,
		body: {
			"path": ""
		}
	}

	return request(options)
	.then(function(responseBody){
		for (var i = responseBody.entries.length - 1; i >= 0; i--) {
			console.log(responseBody.entries[i].name);
		}
		return responseBody.entries[0].name
	})
	.catch(function(err){
		console.log(err);
	});
}

function search(search_term){
	var options = {
		method: 'POST',
		uri: 'https://api.dropboxapi.com/2/files/search ',
		headers: {
			Authorization: 'Bearer 1LmuanYhz_IAAAAAAAAvVffzbjEDiB6riYQ5kWodkVMI2LnuEC2vKJ8dpags027H',
		},
		json: true,
		body: {
			query: search_term,
			path: ""
		}
	}

	return request(options)
	.then(function(responseBody){
		console.log(responseBody.matches[0])
	})
	.catch(function(err){
		console.log(err.message);
	})

}

function simpledefer() {
	df = Q.defer();

	setTimeout(function(){
		df.resolve('asd');
	},1000)

	return df.promise;
}

Q().then(simpledefer).then(getFolders).then(search).finally(function(){console.log("done")})