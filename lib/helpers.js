/**
 * returns request partial with oauth
 * @param  {oauthobject}
 * @return {object}
 */
function GetRequestObject(oauthObject) {
  return {
    method: 'POST',
    headers: { Authorization: `Bearer ${oauthObject.access_token}` },
    json: true,
  };
}

exports.GetRequestObject = GetRequestObject;
