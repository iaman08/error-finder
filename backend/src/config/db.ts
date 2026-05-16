import mongoose from 'mongoose';
import { env } from '@/config/env.js';
import { logger } from '@/config/logger.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 20,
      minPoolSize: 2,
      retryWrites: true,
    });
  }

  try {
    await connectionPromise;
    logger.info({ host: mongoose.connection.host }, 'Connected to MongoDB');
  } catch (error) {
    connectionPromise = null;
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  connectionPromise = null;
  logger.info('Disconnected from MongoDB');
};

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});
