import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

initAdmin();
const db = admin.firestore();

async function migrate() {
  const usersSnap = await db.collection('users').get();
  let moved = 0;
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const entriesSnap = await db.collection('users').doc(userId).collection('entries').get();
    for (const entryDoc of entriesSnap.docs) {
      const data = entryDoc.data();
      const createdAt = data.date || data.created_at || new Date().toISOString();
      const text = data.text || data.content || '';
      await db.collection('diary_entries').doc(entryDoc.id).set({
        user_id: userId,
        created_at: createdAt,
        text,
        locked: data.isLocked || false,
        meta: {
          legacy: true,
          source: 'users/{uid}/entries'
        }
      }, { merge: true });
      moved++;
    }
  }
  console.log(`migrated ${moved} entries`);
}

migrate().catch((err) => {
  console.error('migration failed');
  process.exit(1);
});
