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

// All faces above the threshold, best first. The collection spans every shoot, so the
// single best match is often in another shoot — callers that group faces within one
// shoot need the full list (stored as face.matchedFaceIds).
async function findMatches(faceId) {
  var client = getClient();
  var result = await client.send(new SearchFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceId: faceId,
    FaceMatchThreshold: MATCH_THRESHOLD,
    MaxFaces: 100,
  }));
  return (result.FaceMatches || []).map(function(m) {
    return { faceId: m.Face.FaceId, similarity: m.Similarity };
  });
}

async function findMatch(faceId) {
  return (await findMatches(faceId))[0] || null;
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

// Removes the face from its person's faceIds too — otherwise other faces matching this one would
// keep getting auto-linked to the wrong person via getPersonByFaceId.
async function unlinkFace(faceId) {
  var personId = (_faceIndex || {})[faceId];
  if (!personId) return;
  var person = _cache[personId];
  delete _faceIndex[faceId];
  if (!person) return;
  person.faceIds = person.faceIds.filter(function(fid) { return fid !== faceId; });
  await _db.collection('people').doc(personId).update({ faceIds: person.faceIds });
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
    var matches = await findMatches(faces[i].faceId);
    var match = matches[0];
    if (match) {
      faces[i].matchedFaceId = match.faceId;
      faces[i].matchedFaceIds = matches.map(function(m) { return m.faceId; });
      var person = getPersonByFaceId(match.faceId);
      if (person) {
        await linkFaceToPerson(person.id, faces[i].faceId);
        faces[i].personId = person.id;
      }
    }
  }
  return faces;
}

// Re-searches every face of a photo: refreshes matchedFaceId(s) and, for faces not yet tied to a
// person, links the face to the first named person among its matches. Returns the new faces array
// (caller saves it); existing faceIds and personIds are kept, and hand-set faces (`manual`) are
// never auto-linked.
async function refreshFaceMatches(faces) {
  var out = [];
  for (var f of faces || []) {
    var matches = await findMatches(f.faceId);
    var updated = Object.assign({}, f, {
      matchedFaceId: matches[0] ? matches[0].faceId : (f.matchedFaceId || null),
      matchedFaceIds: matches.map(function(m) { return m.faceId; }),
    });
    if (!updated.personId && !updated.manual) {
      for (var m of matches) {
        var person = getPersonByFaceId(m.faceId);
        if (person) {
          await linkFaceToPerson(person.id, f.faceId);
          updated.personId = person.id;
          break;
        }
      }
    }
    out.push(updated);
  }
  return out;
}

// Inline style for an <img> inside a square, overflow:hidden avatar that shows a square crop
// centred on the face. BoundingBox is in fractions of the photo's width/height, so the photo's
// aspect ratio is needed to keep the crop square (scaling width by 1/Width and height by
// 1/Height independently stretched non-square photos).
function faceAvatarStyle(photo, box) {
  var aspect = photo.width && photo.height ? photo.width / photo.height : 1;
  // in units of photo height: face is (box.Width * aspect) x box.Height, side = the larger one
  var side = Math.max(box.Width * aspect, box.Height);
  var cx = (box.Left + box.Width / 2) * aspect;
  var cy = box.Top + box.Height / 2;
  var w = aspect / side * 100, h = 1 / side * 100;
  var left = 50 - cx / side * 100, top = 50 - cy / side * 100;
  function f(n) { return n.toFixed(2) + '%'; }
  return 'width:' + f(w) + ';height:' + f(h) + ';left:' + f(left) + ';top:' + f(top) + ';';
}

// Groups a shoot's faces for the "find yourself" widget: one group per named person, plus
// anonymous groups of faces that match each other. Hand-set faces (`manual` without a person —
// "this is nobody from the other groups") stay a group of their own.
// opts.includeHidden (admin): keep faces marked `hidden` and flag a group `hidden` when all of its
// faces are; without it (public widget/filter) hidden faces are left out entirely.
function groupShootFaces(slug, shoot, opts) {
  var includeHidden = !!(opts && opts.includeHidden);
  var namedGroups = {}; // personId -> group
  var unnamed = [];     // [{ photo, face }]

  function entry(photo, face) {
    return { slug: slug, photoId: photo.id, faceId: face.faceId, boundingBox: face.boundingBox, thumb: photo.urls && photo.urls.preview, avatarStyle: faceAvatarStyle(photo, face.boundingBox), hidden: !!face.hidden, manual: !!face.manual };
  }

  shoot.photos.forEach(function(photo) {
    (photo.faces || []).forEach(function(face) {
      if (face.hidden && !includeHidden) return;
      if (face.personId) {
        if (!namedGroups[face.personId]) {
          var p = _cache[face.personId];
          namedGroups[face.personId] = { key: 'person:' + face.personId, name: p ? p.name : null, faces: [] };
        }
        namedGroups[face.personId].faces.push(entry(photo, face));
      } else {
        unnamed.push({ photo: photo, face: face });
      }
    });
  });

  var parent = {};
  function find(id) {
    if (!(id in parent)) parent[id] = id;
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  }
  function union(a, b) {
    var ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  var groupable = {}; // unnamed faces that may merge with others (not hand-detached)
  unnamed.forEach(function(item) { find(item.face.faceId); if (!item.face.manual) groupable[item.face.faceId] = true; });
  unnamed.forEach(function(item) {
    if (!groupable[item.face.faceId]) return;
    var ms = item.face.matchedFaceIds || (item.face.matchedFaceId ? [item.face.matchedFaceId] : []);
    ms.forEach(function(m) { if (groupable[m]) union(item.face.faceId, m); });
  });

  var anonGroups = {};
  unnamed.forEach(function(item) {
    var root = find(item.face.faceId);
    if (!anonGroups[root]) anonGroups[root] = { key: 'anon:' + root, name: null, faces: [] };
    anonGroups[root].faces.push(entry(item.photo, item.face));
  });

  var groups = Object.keys(namedGroups).map(function(k) { return namedGroups[k]; })
    .concat(Object.keys(anonGroups).map(function(k) { return anonGroups[k]; }));
  groups.forEach(function(g) { g.hidden = g.faces.every(function(f) { return f.hidden; }); });
  return groups;
}

module.exports = {
  COLLECTION_ID, MATCH_THRESHOLD, ensureCollection, indexFacesForPhoto, findMatch, findMatches,
  initFromFirestore, getPeopleData, getPersonByFaceId, createPerson, linkFaceToPerson, unlinkFace, renamePerson,
  resolvePhotoPeopleNames, indexAndMatchFaces, groupShootFaces, faceAvatarStyle, refreshFaceMatches,
};
