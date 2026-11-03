# 📚 BookNook Server – Backend API

The BookNook Server is the backend API for the BookNook online library application. It provides book management, user authentication, borrowing and returning functionality, and image uploads.

🌐 **Live API:** https://booknook-server-hkrw.onrender.com

💻 **Backend Repository:** https://github.com/fuadcodesDev/booknook-server

🖥️ **Frontend:** https://booknook-client-1ahf.vercel.app/

## ✨ Features

- **Book Management:** Create, retrieve, update, and delete books.
- **User Authentication:** Verify authenticated requests using Better Auth JWT.
- **Book Ownership:** Users can manage only the books they added.
- **Borrowing System:** Allow logged-in users to borrow available books.
- **Return System:** Return borrowed books and restore available copies.
- **Duplicate Borrow Protection:** Prevent users from borrowing the same book multiple times while it is still borrowed.
- **Image Upload:** Upload book cover images using ImgBB.
- **MongoDB Integration:** Store books and borrowing records in MongoDB Atlas.
- **Input Validation:** Validate book information and borrowing requests.

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- MongoDB Node.js Driver
- Better Auth
- JOSE (JWT verification)
- Multer
- ImgBB API
- Render

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check server status |
| GET | `/books` | Get all books |
| GET | `/books/:id` | Get a book by ID |
| POST | `/books` | Add a book |
| PATCH | `/books/:id` | Update a book |
| DELETE | `/books/:id` | Delete a book |
| GET | `/books/my-books` | Get current user's books |
| POST | `/borrows` | Borrow a book |
| GET | `/borrows` | Get current user's borrowed books |
| DELETE | `/borrows/:id` | Return a borrowed book |
| POST | `/upload-image` | Upload a book cover image |

Protected endpoints require a valid Better Auth JWT in the Authorization header:

```text
Authorization: Bearer YOUR_TOKEN
```

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/fuadcodesDev/booknook-server.git
```

### 2. Navigate to the project directory

```bash
cd booknook-server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
BETTER_AUTH_URL=http://localhost:3001
IMGBB_API_KEY=your_imgbb_api_key
```

Replace the placeholder values with your own credentials. Never commit your `.env` file.

### 5. Start the backend server

For development:

```bash
npm run dev
```

For production:

```bash
npm start
```

The local API will be available at:

[http://localhost:5001](http://localhost:5001)

## 🔗 Related Project

Frontend Repository: https://github.com/fuadcodesDev/booknook-client

Live Application: https://booknook-client-1ahf.vercel.app/

## 👨‍💻 Author

**Fuad Chowdhury Safwan**

GitHub: [@fuadcodesDev](https://github.com/fuadcodesDev)