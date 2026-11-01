
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

export const client = new MongoClient(process.env.MONGODB_URI);

export async function connectDB() {
  try {
    await client.connect();

    console.log('Successfully connected to MongoDB Atlas!');

    const db = client.db('BookNookDB');

    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}
