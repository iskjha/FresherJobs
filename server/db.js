import { MongoClient } from 'mongodb';

export const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/fresher_jobs';

export async function connectDb(uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(); // database name comes from the URI path
  await ensureIndexes(db);
  return { client, db };
}

export async function ensureIndexes(db) {
  const jobs = db.collection('jobs');
  await Promise.all([
    // Board columns + default "newest" keyset pagination.
    jobs.createIndex({ active: 1, isFresher: 1, role: 1, postedAt: -1, _id: -1 }),
    jobs.createIndex({ active: 1, isFresher: 1, postedAt: -1, _id: -1 }),
    jobs.createIndex({ active: 1, isFresher: 1, companyKey: 1, postedAt: -1, _id: -1 }),
    jobs.createIndex({ cities: 1 }),
    jobs.createIndex({ lastSeenAt: 1 }),
    db.collection('runs').createIndex({ generatedAt: -1 }),
    db.collection('evaluations').createIndex({ evaluatedAt: -1 }),
  ]);
}
