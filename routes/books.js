
import express from 'express';
import { ObjectId } from 'mongodb';

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

// POST a new book
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const {
      title,
      author,
      category,
      image,
      description,
      totalCopies,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !author?.trim() ||
      !category ||
      !image?.trim() ||
      !description?.trim() ||
      !Number.isInteger(totalCopies) ||
      totalCopies < 1
    ) {
      return res.status(400).json({
        message: 'Please provide valid book information.',
      });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      totalCopies,
      createdAt: new Date(),
    };

    const result = await db
      .collection('books')
      .insertOne(newBook);

    res.status(201).json({
      message: 'Book added successfully!',
      book: {
        _id: result.insertedId,
        ...newBook,
      },
    });
  } catch (error) {
    console.error('Error adding book:', error);

    res.status(500).json({
      message: 'Failed to add book.',
    });
  }
});

// GET one book by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    // Check whether the ID is valid
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid book ID.',
      });
    }

    // Find the book in MongoDB
    const book = await db.collection('books').findOne({
      _id: new ObjectId(id),
    });

    // Check whether the book exists
    if (!book) {
      return res.status(404).json({
        message: 'Book not found.',
      });
    }

    res.status(200).json(book);
  } catch (error) {
    console.error('Error fetching book:', error);

    res.status(500).json({
      message: 'Failed to fetch book.',
    });
  }
});

export default router;
