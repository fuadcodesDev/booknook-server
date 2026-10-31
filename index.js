
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import booksRouter from './routes/books.js';
import borrowsRouter from './routes/borrows.js';


const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Books API
app.use('/books', booksRouter);
// Borrows API
app.use('/borrows', borrowsRouter);

// Test route
app.get('/', (req, res) => {
  res.send('BookNook Server is running!');
});

// Start server
async function startServer() {
  try {
    const db = await connectDB();

    // Make database available to API routes
    app.locals.db = db;

    app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
  }
}

startServer();
