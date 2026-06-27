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

module.exports = { init, getComments, addComment, hideComment };
