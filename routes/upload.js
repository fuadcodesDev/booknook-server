
import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Store the uploaded image temporarily in memory
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maximum 5 MB
  },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed."));
    }

    callback(null, true);
  },
});

// POST /upload-image
router.post("/", verifyToken,(req, res) => {
  upload.single("image")(req, res, async (error) => {
    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select an image to upload.",
        });
      }

      const apiKey = process.env.IMGBB_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          message: "Image upload service is not configured.",
        });
      }

      const formData = new FormData();

      formData.append(
        "image",
        req.file.buffer.toString("base64")
      );

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${apiKey}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("ImgBB upload failed:", result);

        return res.status(502).json({
          message: "Image hosting service could not upload the image.",
        });
      }

      return res.status(201).json({
        message: "Image uploaded successfully!",
        imageUrl: result.data.display_url,
      });
    } catch (error) {
      console.error("Image upload error:", error);

      return res.status(500).json({
        message: "Failed to upload image.",
      });
    }
  });
});

export default router;
