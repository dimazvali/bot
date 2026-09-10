var { FieldValue } = require('firebase-admin/firestore');

var _db = null;

function init(db) {
  _db = db;
}

async function getComments(photoId) {
  var snap = await _db.collection('photoComments')
    .where('photoId', '==', photoId)
    .where('hidden', '==', false)
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map(function(doc) {
    var d = doc.data();
    return {
      id: doc.id,
      userId: d.userId,
      userName: d.userName,
      userPicture: d.userPicture,
      text: d.text,
      createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null,
    };
  });
}

async function addComment(photoId, user, text) {
  var ref = await _db.collection('photoComments').add({
    photoId: photoId,
    userId: user.googleId,
    userName: user.name,
    userPicture: user.picture,
    text: text.trim(),
    createdAt: FieldValue.serverTimestamp(),
    hidden: false,
  });
  return ref.id;
}

async function hideComment(commentId) {
  await _db.collection('photoComments').doc(commentId).update({ hidden: true });
}

async function unhideComment(commentId) {
  await _db.collection('photoComments').doc(commentId).update({ hidden: false });
}

// Every comment across all photos, newest first — for the admin moderation view.
// Sorted/limited by createdAt only (single-field index), 'hidden' is filtered in
// the caller so no composite index is needed.
async function getAllComments(limit) {
  var snap = await _db.collection('photoComments')
    .orderBy('createdAt', 'desc')
    .limit(limit || 500)
    .get();
  return snap.docs.map(function(doc) {
    var d = doc.data();
    return {
      id: doc.id,
      photoId: d.photoId,
      userId: d.userId,
      userName: d.userName,
      userPicture: d.userPicture,
      text: d.text,
      hidden: !!d.hidden,
      createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null,
    };
  });
}

module.exports = { init, getComments, addComment, hideComment, unhideComment, getAllComments };
