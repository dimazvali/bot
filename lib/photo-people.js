var { RekognitionClient, CreateCollectionCommand, IndexFacesCommand, SearchFacesCommand } = require('@aws-sdk/client-rekognition');
var { NodeHttpHandler } = require('@smithy/node-http-handler');
var sharp = require('sharp');

var COLLECTION_ID = 'photo-people-' + (process.env.PHOTO_ENV || 'prod');
var MATCH_THRESHOLD = 90;

var _client = null;
var _collectionReady = false;

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({
      region: process.env.AWS_REGION,
      requestHandler: new NodeHttpHandler({ requestTimeout: 20000, connectionTimeout: 5000 }),
    });
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
  // Rekognition only accepts JPEG/PNG; shoot photos are stored as WebP, so
  // convert here rather than pushing this constraint onto every caller.
  var jpegBuffer = await sharp(imageBuffer).jpeg().toBuffer();
  var client = getClient();
  var result = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: jpegBuffer },
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

function getEnv() { return process.env.PHOTO_ENV || 'prod'; }

var _db = null;
var _cache = null;   // { [personId]: { id, name, faceIds } }
var _faceIndex = null; // { [faceId]: personId }

async function initFromFirestore(db) {
  _db = db;
  var env = getEnv();
  var snap = await db.collection('people').where('env', '==', env).get();
  _cache = {};
  _faceIndex = {};
  snap.docs.forEach(function(doc) {
    var d = doc.data();
    _cache[doc.id] = { id: doc.id, name: d.name, faceIds: d.faceIds || [] };
    (d.faceIds || []).forEach(function(fid) { _faceIndex[fid] = doc.id; });
  });
}

function getPeopleData() { return _cache || {}; }

function getPersonByFaceId(faceId) {
  var personId = (_faceIndex || {})[faceId];
  return personId ? _cache[personId] : null;
}

async function createPerson(name, faceId) {
  var env = getEnv();
  var ref = await _db.collection('people').add({ env: env, name: name, faceIds: [faceId], createdAt: new Date().toISOString() });
  _cache[ref.id] = { id: ref.id, name: name, faceIds: [faceId] };
  _faceIndex[faceId] = ref.id;
  return _cache[ref.id];
}

async function linkFaceToPerson(personId, faceId) {
  var person = _cache[personId];
  if (!person) throw new Error('Person not found: ' + personId);
  if (person.faceIds.indexOf(faceId) === -1) person.faceIds.push(faceId);
  await _db.collection('people').doc(personId).update({ faceIds: person.faceIds });
  _faceIndex[faceId] = personId;
}

async function renamePerson(personId, name) {
  var person = _cache[personId];
  if (!person) throw new Error('Person not found: ' + personId);
  person.name = name;
  await _db.collection('people').doc(personId).update({ name: name });
}

function resolvePhotoPeopleNames(photo) {
  var names = (photo.faces || [])
    .filter(function(f) { return f.personId; })
    .map(function(f) { var p = _cache[f.personId]; return p ? p.name : null; })
    .filter(Boolean);
  return names.filter(function(name, i) { return names.indexOf(name) === i; });
}

async function indexAndMatchFaces(imageBuffer) {
  var faces = await indexFacesForPhoto(imageBuffer);
  for (var i = 0; i < faces.length; i++) {
    var match = await findMatch(faces[i].faceId);
    if (match) {
      var person = getPersonByFaceId(match.faceId);
      if (person) {
        await linkFaceToPerson(person.id, faces[i].faceId);
        faces[i].personId = person.id;
      }
    }
  }
  return faces;
}

module.exports = {
  COLLECTION_ID, ensureCollection, indexFacesForPhoto, findMatch,
  initFromFirestore, getPeopleData, getPersonByFaceId, createPerson, linkFaceToPerson, renamePerson,
  resolvePhotoPeopleNames, indexAndMatchFaces,
};
