
import express from 'express';
import { ObjectId } from 'mongodb';
import { client } from '../config/db.js';

const router = express.Router();

// POST: Borrow a book using a MongoDB transaction
router.post('/', async (req, res) => {
  const session = client.startSession();

  try {
    const db = req.app.locals.db;

    const {
      bookId,
      userEmail,
      borrowDate,
      returnDate,
    } = req.body;

    // Validate borrowing information
    if (
      !ObjectId.isValid(bookId) ||
      typeof userEmail !== 'string' ||
      !userEmail.trim() ||
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

    const normalizedEmail = userEmail.trim().toLowerCase();
    const objectBookId = new ObjectId(bookId);

    let outcome = null;
    let savedBorrow = null;

    // Start transaction
    await session.withTransaction(async () => {

      // Check for an existing active borrowing
      const existingBorrow = await borrowsCollection.findOne(
        {
          bookId: objectBookId,
          userEmail: normalizedEmail,
          status: 'borrowed',
        },
        { session }
      );

      if (existingBorrow) {
        outcome = 'already-borrowed';
        return;
      }

      // Decrease available copies by one
      const updateResult = await booksCollection.updateOne(
        {
          _id: objectBookId,
          totalCopies: { $gt: 0 },
        },
        {
          $inc: { totalCopies: -1 },
        },
        { session }
      );

      if (updateResult.matchedCount === 0) {
        const bookExists = await booksCollection.findOne(
          { _id: objectBookId },
          { session }
        );

        outcome = bookExists ? 'unavailable' : 'not-found';
        return;
      }

      // Find the book information
      const book = await booksCollection.findOne(
        { _id: objectBookId },
        { session }
      );

      const newBorrow = {
        bookId: objectBookId,
        bookTitle: book.title,
        bookImage: book.image,
        userEmail: normalizedEmail,
        borrowDate: borrowedAt,
        returnDate: returnAt,
        status: 'borrowed',
        createdAt: new Date(),
      };

      // Save borrowing record
      const result = await borrowsCollection.insertOne(
        newBorrow,
        { session }
      );

      savedBorrow = {
        _id: result.insertedId,
        ...newBorrow,
      };

      outcome = 'success';
    });

    // Handle transaction results
    if (outcome === 'already-borrowed') {
      return res.status(409).json({
        message: 'You have already borrowed this book.',
      });
    }

    if (outcome === 'unavailable') {
      return res.status(409).json({
        message: 'No copies are currently available.',
      });
    }

    if (outcome === 'not-found') {
      return res.status(404).json({
        message: 'Book not found.',
      });
    }

    return res.status(201).json({
      message: 'Book borrowed successfully!',
      borrow: savedBorrow,
    });

  } catch (error) {
    console.error('Error borrowing book:', error);

    return res.status(500).json({
      message: 'Failed to borrow book.',
    });

  } finally {
    await session.endSession();
  }
});


// GET: Retrieve all borrowing records
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const borrows = await db
      .collection('borrows')
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(borrows);

  } catch (error) {
    console.error('Error fetching borrowing records:', error);

    res.status(500).json({
      message: 'Failed to fetch borrowing records.',
    });
  }
});


// DELETE: Return a borrowed book using a transaction
router.delete('/:id', async (req, res) => {
  const session = client.startSession();

  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid borrowing ID.',
      });
    }

    const borrowsCollection = db.collection('borrows');
    const booksCollection = db.collection('books');

    let outcome = null;

    // Start transaction
    await session.withTransaction(async () => {

      // Find an active borrowing record
      const borrow = await borrowsCollection.findOne(
        {
          _id: new ObjectId(id),
          status: 'borrowed',
        },
        { session }
      );

      if (!borrow) {
        outcome = 'not-found';
        return;
      }

      // Mark borrowing record as returned
      const result = await borrowsCollection.updateOne(
        {
          _id: new ObjectId(id),
          status: 'borrowed',
        },
        {
          $set: {
            status: 'returned',
            returnedAt: new Date(),
          },
        },
        { session }
      );

      if (result.modifiedCount === 0) {
        outcome = 'already-returned';
        return;
      }

      // Restore one available copy
      const bookResult = await booksCollection.updateOne(
        { _id: borrow.bookId },
        { $inc: { totalCopies: 1 } },
        { session }
      );

      if (bookResult.matchedCount === 0) {
        throw new Error('Original book not found.');
      }

      outcome = 'success';
    });

    if (outcome === 'not-found') {
      return res.status(404).json({
        message: 'Borrowing record not found or already returned.',
      });
    }

    if (outcome === 'already-returned') {
      return res.status(409).json({
        message: 'This book has already been returned.',
      });
    }

    return res.status(200).json({
      message: 'Book returned successfully!',
    });

  } catch (error) {
    console.error('Error returning book:', error);

    return res.status(500).json({
      message: 'Failed to return book.',
    });

  } finally {
    await session.endSession();
  }
});

export default router;
