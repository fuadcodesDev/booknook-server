
import express from 'express';

const router = express.Router();

// GET all books
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const books = await db
      .collection('books')
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(books);
  } catch (error) {
    console.error('Error fetching books:', error);

    res.status(500).json({
      message: 'Failed to fetch books',
    });
  }
});

export default router;
