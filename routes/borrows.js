import express from 'express';
import { ObjectId } from 'mongodb';

const router = express.Router();

// POST: Borrow a book
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const {
      bookId,
      userEmail,
      borrowDate,
      returnDate,
    } = req.body;

    // Validate the information
    if (
      !ObjectId.isValid(bookId) ||
      !userEmail?.trim() ||
      !borrowDate ||
      !returnDate
    ) {
      return res.status(400).json({
        message: 'Please provide valid borrowing information.',
      });
    }

    const borrowedAt = new Date(borrowDate);
    const returnAt = new Date(returnDate);

    if (
      Number.isNaN(borrowedAt.getTime()) ||
      Number.isNaN(returnAt.getTime()) ||
      returnAt <= borrowedAt
    ) {
      return res.status(400).json({
        message: 'Please provide valid borrowing dates.',
      });
    }

    const booksCollection = db.collection('books');
    const borrowsCollection = db.collection('borrows');

    // Check whether the user already borrowed this book
    const existingBorrow = await borrowsCollection.findOne({
      bookId: new ObjectId(bookId),
      userEmail: userEmail.trim().toLowerCase(),
      status: 'borrowed',
    });

    if (existingBorrow) {
      return res.status(409).json({
        message: 'You have already borrowed this book.',
      });
    }

    // Reduce available copies by one
    const updateResult = await booksCollection.updateOne(
      {
        _id: new ObjectId(bookId),
        totalCopies: { $gt: 0 },
      },
      {
        $inc: { totalCopies: -1 },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        message: 'Book not found or no copies are available.',
      });
    }

    // Save the borrowing record
    try {
      const book = await booksCollection.findOne({
        _id: new ObjectId(bookId),
      });

      const newBorrow = {
        bookId: new ObjectId(bookId),
        bookTitle: book.title,
        bookImage: book.image,
        userEmail: userEmail.trim().toLowerCase(),
        borrowDate: borrowedAt,
        returnDate: returnAt,
        status: 'borrowed',
        createdAt: new Date(),
      };

      const result = await borrowsCollection.insertOne(newBorrow);

      res.status(201).json({
        message: 'Book borrowed successfully!',
        borrow: {
          _id: result.insertedId,
          ...newBorrow,
        },
      });
    } catch (error) {
      // Restore the copy if saving the borrowing record fails
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { totalCopies: 1 } }
      );

      throw error;
    }
  } catch (error) {
    console.error('Error borrowing book:', error);

    res.status(500).json({
      message: 'Failed to borrow book.',
    });
  }
});

export default router;