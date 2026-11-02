
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import booksRouter from './routes/books.js';
import borrowsRouter from './routes/borrows.js';
import uploadRouter from "./routes/upload.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/books', booksRouter);
app.use('/borrows', borrowsRouter);
app.use("/upload-image", uploadRouter);

// Server test route
app.get('/', (req, res) => {
  res.status(200).send('BookNook Server is running!');
});

// Start server
async function startServer() {
  try {
    const db = await connectDB();

    // Make database available to API routes
    app.locals.db = db;

    // Prevent duplicate active borrowing records
    await db.collection('borrows').createIndex(
      {
        bookId: 1,
        userEmail: 1,
      },
      {
        unique: true,
        partialFilterExpression: {
          status: 'borrowed',
        },
        name: 'unique_active_borrow_per_user_book',
      }
    );

    console.log('Active borrowing protection enabled!');

    app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
