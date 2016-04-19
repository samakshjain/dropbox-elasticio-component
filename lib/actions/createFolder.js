var elasticio = require("elasticio-node");
var messages = elasticio.messages;
var Q = require("q");
var request = require("request-promise");
var baseURL = require("../globals.js").baseURL;
var shareURL = require("../globals.js").shareURL;

exports.process = processAction;

function processAction(message, config) {
  var env = process.env;
  var self = this;
  var body = message.body;
  var oauth = config.oauth;
  var emailAddress = body.ownerEmail;

  var ownerFolder = body.ownerName + "_" + body.ownerId;
  var leadFolder = body.leadName + "_" + body.leadId;
  var owner_folder_created = false;

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
      console.log("\n<--------- Authorization ---------->\n");
      console.log(data);
      oauth = data;
      return ownerFolder;
    });
  }


  /**
   * Checks if folder exists, if it doesn't returns function to create one.
   * @param  {string} folder_name Folder name string to search for
   * @return {function}             Function to create a folder
   */
  function checkIfFolderExists() {
    console.log("\n<----------- Checking if folder exists ----------->\n");
    var path = "";
    // Check if owner folder is created already
    if (owner_folder_created) {
      folder_name = leadFolder;
      path = "/" + ownerFolder;
    } else {
      folder_name = ownerFolder;
    }
    var qs = {
        "path": path,
        "query": folder_name,
        "start": 0,
        "max_results": 10,
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
      console.log("\n<--------- Searching if folder exists ---------->\n");
      if (data.matches.length === 0) {
        console.log("\n<----------- Folder does not exist ----------->\n");
        return false;
      } else {
        console.log("\n<----------- Folder exists ----------->\n");
        return true;
      }
    })
    .catch(function(err){
      console.log("\n<----------- Error checking if folder exists ----------->\n");
      console.log('err ' , err);
    });
  }


  /**
   * Creates a folder on dropbox with the given name
   * @param  {string} name Name of the folder to create
   * @return {promise}      Returns a request-promise object
   */
  function createFolder(exists) {
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
    if (exists){
      console.log("\n<--------- Folder Exists, not creating ---------->\n");
      
      var defer = Q.defer();

      defer.resolve({status:"exists"});

      return defer.promise;

    } else {
      console.log("\n<--------- Folder DNE, creating ---------->\n");
      
      return request(options)
      .then(function(data) {
        if (got_owner_folder) {
          console.log("\n<--------- Success! ---------->\n");
          console.log("Folder "+ data.name + "created");
        } else {
          got_owner_folder = true;
          // Add email permission to the owner folder
          makeShareable();
        }
      })
      .catch(function(err){
        console.log("\n<----------- Error at creating folder ----------->\n");
        console.log('err ' , err);
      });
    }
    }

  function makeShareable (){
    // return a request promise here
    var body = {
              "path": "/"+ownerFolder,
              "member_policy": "anyone",
              "acl_update_policy": "editors",
              "shared_link_policy": "anyone",
              "force_async": false
    };
    var options = {
      method: "POST",
      url: shareURL + "/share_folder",
      body: body,
      headers: {
        "Authorization": "Bearer " + oauth.access_token
      },
      json: true
    };
    request(options).then(function(data){
       shareToOwnerEmail(data.shared_folder_id);
    }).catch(function(err){
      console.log("\n<--------- Error making shareable ---------->\n");
      console.log('err',err);
    })
  };


  function shareToOwnerEmail(shared_folder_id) {
    // return a request promise here
    var options = {
      method: "POST",
      uri: shareURL + "/add_folder_member",
      headers: {
        "Authorization": "Bearer "+ oauth.access_token
      },
      json: true
    }

    var body = {
      "shared_folder_id": shared_folder_id,
      "members": [
          {
              "member": {
                  ".tag": "email",
                  "email": ownerEmail
              },
              "access_level": {
                  ".tag": "editor"
              }
          }
      ],
      "quiet": false,
      "custom_message": "Owner folder created."
    }
    request(options).then(function(){
      console.log("\n<--------- Sent email to owner ---------->\n");
      
    }).catch(function(err){
      console.log("\n<--------- Error at sharing Folder to owner ---------->\n");
      console.log(err);
    })

  }

  /**
   * Check for Auth, if OK: 
   * 1. Check if owner_folder exists.
   *  a. If it does not exist: 
   *    > Create the folder with the name.
   *    > Make Owner Folder Shareable
   *    > Share to owner Email
   *    > return created owner_folder_name.
   *  b. If it exists:
   *    > return owner_folder_name.
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
  .then(createFolder)
  .then(checkIfFolderExists)
  .then(createFolder)
  .then(emitData)
  .fail(emitError)
  .done(emitEnd);
}