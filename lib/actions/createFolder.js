"use strict";

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
  var owner_folder_exists = false;

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

    console.log("\n-----------> Emitting Data");
    console.log("\n-----------> Data ");
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
    console.log("\n-----------> Error Occured");
    self.emit("error", e);
  }


  /**
   * marks the end of emit cycle
   * @return {none} 
   */
  function emitEnd() {
    console.log("\n-----------> Execution Completed!");
    self.emit("end");
  }

  /**
   * Checks if folder exists, if it doesn't, returns a function to create one.
   * @param  {string} folder_name Folder name string to search for
   * @return {function} Function to create a folder
   */
  function checkIfFolderExists() {
    var path = "";
    // Check if owner folder is created already
    var folder_name = ownerFolder;
    if (owner_folder_created) {
      folder_name = leadFolder;
      path = "/" + ownerFolder;
    }
    var body = {
        "path": path,
        "query": folder_name,
        "start": 0,
        "max_results": 10,
        "mode": "filename"
      };
    var options = {
      method: "POST",
      uri: baseURL + '/search',
      body: body,
      headers: {
        "Authorization": "Bearer " + oauth.access_token
      },
      json: true
    };

    return request(options)
    .then(function(data) {
      console.log("\n-----------> Searching if folder exists");
      if (data.matches.length === 0) {
        console.log("\n-----------> Folder does not exist");
        return false;
      } else {
        console.log("\n-----------> Folder exists");
        owner_folder_exists = true;
        return true;
      }
    })
    .catch(function(err){
      console.log("\n-----------> Error checking if folder exists");
      console.log('err ' , err);
    });
  }


  /**
   * Creates a folder on dropbox with the given name
   * @param  {string} name Name of the folder to create
   * @return {promise}      Returns a request-promise object
   */
  function createFolder(exists) {
      console.log("\n-----------> exists:", exists);
      
      var data = {
        "path": "/" + ownerFolder
      };

      if (owner_folder_created) {
        data.path = "/" + ownerFolder + "/" + leadFolder;
      }

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

        console.log("\n-----------> Folder Exists, not creating");
        var df = Q.defer();
        owner_folder_created = true;
        df.resolve('Folder Already Exists');
        return df.promise;

      } else {

        console.log("\n-----------> Folder DNE");
        console.log("\n-----------> Creating Folder:", data.path);
        return request(options)
        .then(function(data) {
          if (owner_folder_created) {
            console.log("\n-----------> Success!");
            console.log("Folder "+ data.name + "created");
          } else {
            owner_folder_created = true;
            // Add email permission to the owner folder
            makeShareable();
          }
        })
        .catch(function(err){
          console.log("\n-----------> Error at creating folder");
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
      console.log("\n-----------> Error making shareable");
      console.log('err',err);
    })
  };

  for (var i = Things.length - 1; i >= 0; i--) {
    Things[i]
  }

  function shareToOwnerEmail(shared_folder_id) {
    var body = {
      "shared_folder_id": shared_folder_id,
      "members": [
          {
              "member": {
                  ".tag": "email",
                  "email": emailAddress
              },
              "access_level": {
                  ".tag": "editor"
              }
          }
      ],
      "quiet": false,
      "custom_message": "Owner folder created."
    }

    // return a request promise here
    var options = {
      method: "POST",
      uri: shareURL + "/add_folder_member",
      headers: {
        "Authorization": "Bearer "+ oauth.access_token
      },
      body: body,
      json: true
    }

    request(options).then(function(){
      console.log("\n-----------> Sent email to owner");
      
    }).catch(function(err){
      console.log("\n-----------> Error at sharing Folder to owner");
      console.log(err);
    })

  }

  Q()
  .then(checkIfFolderExists)
  .then(createFolder)
  .then(checkIfFolderExists)
  .then(createFolder)
  .then(emitData)
  .fail(emitError)
  .done(emitEnd);
}