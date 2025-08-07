import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({ path: './env' });

const PORT = process.env.PORT || 8000;
connectDB()
  .then(() => {
    app.on('error', (error) => {
      console.log('ERror: ', error);
      process.exit(1);
    });

    app.listen(PORT, () => {
      console.log(`server is running on port: `, PORT);
    });
  })
  .catch((err) => console.log('mongodb connection failed', err));
/*
import express from 'express';
const app = express();

(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on('error', (error) => {
      console.log('error', error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log('app is listening');
    });
  } catch (error) {
    console.error('ERROR: ', error);
    throw err;
  }
})();
*/
