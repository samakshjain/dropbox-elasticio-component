const q = require('q');
const elasticio = require('elasticio-node');
const messages = elasticio.messages;
const rp = require('request-promise');

// helper imports
const globals = require('../globals.js');
const helpers = require('../helpers.js');

function ecoOrderAction(msg, cfg) {
  const self = this;
  const oauth = cfg.oauth;
  const messageBody = msg.body;
  const leadPath = `/${messageBody.ownerName}_${messageBody.ownerId}/${messageBody.leadName}_${messageBody.leadId}`;

  /**
   * Creates a folder with the given path
   * @param  {string} path Path of the folder to create
   * @return {promise or 0}      Returns a request-promise object or 0 if the
   *                     				 if the folder already exists
   */
  function createFolder(path) {
    const requestObject = new helpers.GetRequestObject(oauth);
    requestObject.uri = `${globals.baseURL}/create_folder`;
    requestObject.body = { path };
    return rp(requestObject)
      .then((responseBody) => {
        console.log('\n-----------> Created Folder:', path);
        if (responseBody.sharing_info === undefined) {
          let pathLower = responseBody.path_lower.split('/')[1];
          pathLower = `/${pathLower}`;
          return pathLower;
        }
        return 0;
      })
      .catch((err) => {
        if (err.statusCode === 409) {
          return 0;
        }
        return q.reject(err);
      });
  }

    /**
     * Makes a folder share-able
     * @param  {string or 0} path Takes in path of the owner folder to make
     *                     		 		it share-able
     * @return {Promise or 0}     0 when path is 0 else a Promise
     */
  function makeShareable(path) {
    if (path !== 0) {
    // return a request promise here
      const body = {
        path,
        member_policy: 'anyone',
        acl_update_policy: 'editors',
        shared_link_policy: 'anyone',
        force_async: false,
      };
      const requestObject = new helpers.GetRequestObject(oauth);
      requestObject.uri = `${globals.shareURL}/share_folder`;
      requestObject.body = body;
      return rp(requestObject)
      .then((responseBody) => responseBody.shared_folder_id);
    }
    return 0;
  }

    /**
     * Share to owner's email Id
     * @param  {string} folderId Id of the owner folder
     * @return {promise}         Promise of the request
     */
  function shareToOwnerEmail(sharedFolderId) {
    if (sharedFolderId !== 0) {
      const body = {
        shared_folder_id: sharedFolderId,
        members: [
          {
            member: {
              '.tag': 'email',
              email: messageBody.ownerEmail,
            },
            access_level: {
              '.tag': 'editor',
            },
          },
        ],
        quiet: false,
        custom_message: 'Owner folder created.',
      };

      const requestObject = new helpers.GetRequestObject(oauth);
      requestObject.uri = `${globals.shareURL}/add_folder_member`;
      requestObject.body = body;
      return rp(requestObject)
        .then(() => {
          const dataToEmit = {
            url: `https://www.dropbox.com/home${leadPath}`,
            lead_id: messageBody.leadId,
            id: messageBody.ownerId,
          };
          return dataToEmit;
        });
    }
    return {
      url: `https://www.dropbox.com/home${leadPath}`,
      lead_id: messageBody.leadId,
    };
  }

  /**
   * Emits data to aplynk
   * @param  {object} dataToEmit Object with data to emit
   * @return {undefined}            Returns nothing
   */
  function emitData(dataToEmit) {
    console.log('\n-----------> Emitting Data');
    console.log(dataToEmit);
    const data = messages.newMessageWithBody(dataToEmit);
    self.emit('data', data);
  }

  /**
   * emits error to aplynk
   * @param  {error} e Error occured in emitData
   * @return {[type]}   [description]
   */
  function emitError(e) {
    console.log('\n -----------> Dagnabbit! Error occurred \n');
    console.log(`\n -----------> ${e}\n`);
    self.emit('error', e);
  }

  /**
   * marks the end of emit cycle
   * @return {none}
   */
  function emitEnd() {
    console.log('\n -----------> Finished execution');
    self.emit('end');
  }

  q(leadPath)
    .then(createFolder)
    .then(makeShareable)
    .then(shareToOwnerEmail)
    .then(emitData)
    .fail(emitError)
    .done(emitEnd);
}

exports.process = ecoOrderAction;
