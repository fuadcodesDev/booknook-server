
import express from 'express';
import { ObjectId } from 'mongodb';
import { client } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// POST: Borrow a book — Login required
router.post('/', verifyToken, async (req, res) => {
  const session = client.startSession();

  try {
    const db = req.app.locals.db;
    const { bookId, borrowDate, returnDate } = req.body;

    const normalizedEmail = req.user.email?.trim().toLowerCase();

    // Validate borrowing information
    if (
      !bookId ||
      !ObjectId.isValid(bookId) ||
      !normalizedEmail ||
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
    const objectBookId = new ObjectId(bookId);

    let outcome = null;
    let savedBorrow = null;

    await session.withTransaction(async () => {
      // Check for an existing active borrowing record
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

      // Decrease stock only if copies are available
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

      // Get book information from the database
      const book = await booksCollection.findOne(
        { _id: objectBookId },
        { session }
      );

      if (!book) {
        throw new Error('Book not found after stock update.');
      }

      // Create borrowing record
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

    // Unique index prevents duplicate active borrowing records
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You have already borrowed this book.',
      });
    }

    return res.status(500).json({
      message: 'Failed to borrow book.',
    });

  } finally {
    await session.endSession();
  }
});


// GET: Retrieve only the logged-in user's borrowing records
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const normalizedEmail = req.user.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(401).json({
        message: 'User information is missing from the token.',
      });
    }

    const borrows = await db
      .collection('borrows')
      .find({ userEmail: normalizedEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json(borrows);

  } catch (error) {
    console.error('Error fetching borrowing records:', error);

    return res.status(500).json({
      message: 'Failed to fetch borrowing records.',
    });
  }
});


// DELETE: Return a book — Only its borrower can return it
router.delete('/:id', verifyToken, async (req, res) => {
  const session = client.startSession();

  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const normalizedEmail = req.user.email?.trim().toLowerCase();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid borrowing ID.',
      });
    }

    if (!normalizedEmail) {
      return res.status(401).json({
        message: 'User information is missing from the token.',
      });
    }

    const borrowsCollection = db.collection('borrows');
    const booksCollection = db.collection('books');
    const borrowId = new ObjectId(id);

    let outcome = null;

    await session.withTransaction(async () => {
      // Find an active borrowing record belonging to this user
      const borrow = await borrowsCollection.findOne(
        {
          _id: borrowId,
          status: 'borrowed',
          userEmail: normalizedEmail,
        },
        { session }
      );

      if (!borrow) {
        outcome = 'not-found';
        return;
      }

      // Mark the borrowing record as returned
      const result = await borrowsCollection.updateOne(
        {
          _id: borrowId,
          status: 'borrowed',
          userEmail: normalizedEmail,
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
