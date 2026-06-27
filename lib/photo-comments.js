// lib/photo-comments.js
var { getApps } = require('firebase-admin/app');
var { getFirestore, FieldValue } = require('firebase-admin/firestore');

function getDb() {
  var app = getApps().find(function(a) { return a.name === 'photo'; });
  if (!app) throw new Error('photo Firebase app not initialized');
  return getFirestore(app);
}

async function getComments(photoId) {
  var db = getDb();
  var snap = await db.collection('photoComments')
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
  var db = getDb();
  var ref = await db.collection('photoComments').add({
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
  var db = getDb();
  await db.collection('photoComments').doc(commentId).update({ hidden: true });
}

module.exports = { getComments, addComment, hideComment };
