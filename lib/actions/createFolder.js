var elasticio = require("elasticio-node");
var messages = elasticio.messages;
var Q = require("q");
var request = require("request-promise");
var baseURL = require("../globals.js").baseURL;

exports.process = processAction;

function processAction(message, config) {
	var env = process.env;
	var self = this;
	var body = message.body;
	var oauth = config.oauth;
	var emailAddress = body.ownerEmail;

	var ownerFolder = body.ownerName + "_" + body.ownerId;
	var leadFolder = body.leadName + "_" + body.leadId;
	var got_owner_folder = false;

	console.log("Config : %j", config);


	/**
	 * emits Data to aplynk
	 * @return {none} 
	 */
	function emitData() {
		var data = {
			"id": leadFolder,
			"lead_id": body.leadId,
			"url": "https://www.dropbox.com/home/" + leadFolder
		};

		console.log("\n<----------- Emitting Data ----------->\n");
		console.log("\n<----------- Data ----------->\n");
		console.log(data);

		if (data) {
			var wrappedData = messages.newMessageWithBody(data);
			self.emit("data", wrappedData);
		}
	}


	/**
	 * emits error to aplynk
	 * @param  {error} e Error occured in emitData
	 * @return {[type]}   [description]
	 */
	function emitError(e) {
		console.log("\n<----------- Error Occured ----------->\n");
		self.emit("error", e);
	}


	/**
	 * marks the end of emit cycle
	 * @return {none} 
	 */
	function emitEnd() {
		console.log("\n<----------- Execution Completed! ----------->\n");
		self.emit("end");
	}


	/**
	 * Get a new auth_token from refresh_token
	 * @return {promise}
	 */
	function auth() {
		var form = {
			refresh_token: oauth.refresh_token,
			grant_type: "refresh_token",
			client_id: env.DROPBOX_APP_KEY,
			client_secret: env.DROPBOX_APP_SECRET
		};
		var options = {
			method: "POST",
			uri: "https://www.dropbox.com/1/oauth2/token",
			form: form,
			json: true
		};

		return request(options).then(function(data) {
			oauth = data;
			return ownerFolder;
		});
	}


	/**
	 * Checks if folder exists, if it doesn't returns function to create one.
	 * @param  {string} folder_name Folder name string to search for
	 * @return {function}             Function to create a folder
	 */
	function checkIfFolderExists(folder_name) {
		console.log("\n<----------- Checking if folder exists ----------->\n");
		var qs = {
			    "path": "",
			    "query": folder_name,
			    "start": 0,
			    "max_results": 100,
			    "mode": "filename"
			};
		var options = {
			uri: baseURL + '/search',
			qs: qs,
			headers: {
				"Authorization": "Bearer " + oauth.access_token
			},
			json: true
		};

		return request(options)
		.then(function(data) {
			if (data.matches.length == 0) {
				console.log("\n<----------- Folder does not exist ----------->\n");
				return createFolder(folder_name);
			} else {
				console.log("\n<----------- Folder exists ----------->\n");
				got_owner_folder = true;
				return leadFolder;
			}
		})
		.catch(function(err){
			console.log("\n<----------- Error checking if folder exists ----------->\n");
			console.log('err ' , err);
		})
	}


	/**
	 * Creates a folder on dropbox with the given name
	 * @param  {string} name Name of the folder to create
	 * @return {promise}      Returns a request-promise object
	 */
	function createFolder(name) {
		var data = {
    		"path": "/" + name
		};

		if (got_owner_folder) {
			data.path = "/" + ownerFolderId + "/" + name;
		}
		console.log("\n<----------- Creating Folder -----------> : ", data.path);

		var options = {
			method: "POST",
			uri: baseURL+ '/create_folder',
			body: data,
			headers: {
				"Authorization": "Bearer " + oauth.access_token
			},
			json: true
		};
		return request(options)
		.then(function(data) {
			if (got_owner_folder) {
				return data.name;
			} else {
				got_owner_folder = true;
				// Add email permission to the owner folder
				addPermission(data.name);
			}
		})
		.catch(function(err){
			console.log("\n<----------- Error at creating folder ----------->\n");
			console.log('err ' , err);
		});
	}

	function makeShareable (){

	};


	function shareToOwnerEmail() {

	}



	function addPermission(ownerFolderId) {
		console.log(" --------- Adding Permission to Owner Folder --------- :" + ownerFolderId);
		var data = {
			"type": "user",
			"role": "writer",
			"emailAddress": emailAddress
		}

		var options = {
			method: "POST",
			uri: "https://www.googleapis.com/drive/v3/files/" + ownerFolderId + "/permissions?transferOwnership=false",
			body: data,
			headers: {
				"Authorization": "Bearer " + oauth.access_token
			},
			json: true
		}

		console.log(" --------- Creating permission --------- : %j", options);
		return request(options).then(function(error, response, body) {
			if (error !== null) {
				console.log('error ' , error);
			}
			console.log("\n<----------- Response ----------->\n");
			console.log(body);
		})
			console.log("\n<----------- Message ----------->\n");
	}

	/**
	 * Check for Auth, if OK: 
	 * 1. Check if owner_folder exists.
	 * 	a. If it does not exist: 
	 * 	  > Create the folder with the name.
	 * 	  > Make Owner Folder Shareable
	 *    > Share to owner Email
	 * 	  > return created owner_folder_name.
	 * 	b. If it exists:
	 * 	  > return owner_folder_name.
	 * 	  
	 * At this point we have an owner folder
	 * 
	 * 2. From the owner_folder name returned:
	 *   a. Check if lead_folder exists in the owner_folder_name:
	 *     > If it does:
	 *       * Return created lead_folder name
	 *     > If folder does not exist:
	 *       * Create a folder with lead_folder_name
	 *       * Return lead_folder_name
	 * 

	 */

	Q()
	.then(auth)
	.then(checkIfFolderExists)
	.then(checkIfFolderExists)
	.then(emitData)
	.fail(emitError)
	.done(emitEnd);
}