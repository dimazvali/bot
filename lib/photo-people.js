var { RekognitionClient, CreateCollectionCommand, IndexFacesCommand, SearchFacesCommand } = require('@aws-sdk/client-rekognition');

var COLLECTION_ID = 'photo-people-' + (process.env.PHOTO_ENV || 'prod');
var MATCH_THRESHOLD = 99;

var _client = null;
var _collectionReady = false;

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({ region: process.env.AWS_REGION });
  }
  return _client;
}

async function ensureCollection() {
  if (_collectionReady) return;
  var client = getClient();
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
  } catch (e) {
    if (e.name !== 'ResourceAlreadyExistsException') throw e;
  }
  _collectionReady = true;
}

async function indexFacesForPhoto(imageBuffer) {
  await ensureCollection();
  var client = getClient();
  var result = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: imageBuffer },
    DetectionAttributes: [],
  }));
  return (result.FaceRecords || []).map(function(r) {
    return { faceId: r.Face.FaceId, boundingBox: r.Face.BoundingBox };
  });
}

async function findMatch(faceId) {
  var client = getClient();
  var result = await client.send(new SearchFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceId: faceId,
    FaceMatchThreshold: MATCH_THRESHOLD,
    MaxFaces: 1,
  }));
  var match = (result.FaceMatches || [])[0];
  if (!match) return null;
  return { faceId: match.Face.FaceId, similarity: match.Similarity };
}

module.exports = { COLLECTION_ID, ensureCollection, indexFacesForPhoto, findMatch };
