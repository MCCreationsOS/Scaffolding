import { initializeApp } from 'firebase-admin/app';
import { key } from '../firebaseKey.js';
import { credential } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
initializeApp({
    credential: credential.cert(JSON.stringify(key)),
    databaseURL: 'https://mccreations-c3cb8.firebaseio.com'
});
export const auth = getAuth();
