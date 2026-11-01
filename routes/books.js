
import express from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from '../middleware/verifyToken.js';
import { client } from '../config/db.js';

const router = express.Router();

// GET all books — Public route
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
      message: 'Failed to fetch books.',
    });
  }
});

// POST a new book — Login required
router.post('/', verifyToken, async (req, res) => {
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
      !category?.trim() ||
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
      category: category.trim(),
      image: image.trim(),
      description: description.trim(),
      totalCopies,

      // Ownership comes from the verified JWT
      ownerId: req.user.id,
      ownerEmail: req.user.email,

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

// GET books added by the logged-in user — Login required
router.get('/my-books', verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const books = await db
      .collection('books')
      .find({ ownerId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching user's books:", error);

    res.status(500).json({
      message: 'Failed to fetch your books.',
    });
  }
});

// GET one book by ID — Public route
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid book ID.',
      });
    }

    const book = await db.collection('books').findOne({
      _id: new ObjectId(id),
    });

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

// PATCH a book — Only its owner can edit
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    const {
      title,
      author,
      category,
      image,
      description,
      totalCopies,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid book ID.',
      });
    }

    if (
      !title?.trim() ||
      !author?.trim() ||
      !category?.trim() ||
      !image?.trim() ||
      !description?.trim() ||
      !Number.isInteger(totalCopies) ||
      totalCopies < 1
    ) {
      return res.status(400).json({
        message: 'Please provide valid book information.',
      });
    }

    const updatedBook = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      image: image.trim(),
      description: description.trim(),
      totalCopies,
      updatedAt: new Date(),
    };

    const result = await db.collection('books').updateOne(
      {
        _id: new ObjectId(id),
        ownerId: req.user.id,
      },
      {
        $set: updatedBook,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: 'Book not found or you do not have permission to edit it.',
      });
    }

    res.status(200).json({
      message: 'Book updated successfully!',
    });
  } catch (error) {
    console.error('Error updating book:', error);

    res.status(500).json({
      message: 'Failed to update book.',
    });
  }
});

// DELETE a book — Only its owner can delete
// Uses a MongoDB transaction to protect against borrow/delete conflicts
router.delete('/:id', verifyToken, async (req, res) => {
  const session = client.startSession();

  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid book ID.',
      });
    }

    const bookId = new ObjectId(id);

    let response;

    // Run all checks and deletion inside one transaction
    await session.withTransaction(async () => {
      // Check whether the book belongs to the logged-in user
      const book = await db.collection('books').findOne(
        {
          _id: bookId,
          ownerId: req.user.id,
        },
        { session }
      );

      if (!book) {
        response = {
          status: 404,
          message: 'Book not found or you do not have permission to delete it.',
        };

        return;
      }

      // Check for active borrowing records
      const activeBorrow = await db.collection('borrows').findOne(
        {
          bookId,
          status: 'borrowed',
        },
        { session }
      );

      if (activeBorrow) {
        response = {
          status: 409,
          message: 'This book cannot be deleted while it has active borrowing records.',
        };

        return;
      }

      // Delete the book inside the transaction
      const result = await db.collection('books').deleteOne(
        {
          _id: bookId,
          ownerId: req.user.id,
        },
        { session }
      );

      if (result.deletedCount === 0) {
        response = {
          status: 404,
          message: 'Book not found or you do not have permission to delete it.',
        };

        return;
      }

      response = {
        status: 200,
        message: 'Book deleted successfully!',
      };
    });

    return res.status(response.status).json({
      message: response.message,
    });
  } catch (error) {
    console.error('Error deleting book:', error);

    return res.status(500).json({
      message: 'Failed to delete book.',
    });
  } finally {
    await session.endSession();
  }
});

export default router;
