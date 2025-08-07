import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
// origin should be the url from where the backend gets req... but should be a url instead of *
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
// url has %20 or + for querries so for that below
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public')); // storing on my own server if done so
app.use(cookieParser()); // secure access or set on user's browser, only server can do crud on it

// routes
import userRouter from './routes/user.routes.js';

// routes declaration
app.use('/api/v1/users', userRouter); // localhost:port/api/v1/users/register

export { app };
