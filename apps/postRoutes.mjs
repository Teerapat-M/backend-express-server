import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import multer from "multer";
import { validateCreatePost } from "../utils/postValidation.mjs";
import { uploadBlogFile } from "../utils/storage.mjs";

const postRouter = Router();
const imageFileUpload = multer({ storage: multer.memoryStorage() }).fields([
  { name: "imageFile", maxCount: 1 },
]);

postRouter.post(
  "/",
  [imageFileUpload, validateCreatePost, protectAdmin],
  async (req, res) => {
    try {
      const newPost = req.body;
      const file = req.files?.imageFile?.[0];
      let imageUrl = newPost.image;

      if (file) {
        imageUrl = await uploadBlogFile(
          `posts/${Date.now()}_${file.originalname}`,
          file
        );
      }

      const result = await connectionPool.query(
        `INSERT INTO posts (title, image, category_id, description, content, status_id, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          newPost.title,
          imageUrl,
          newPost.category_id,
          newPost.description,
          newPost.content,
          newPost.status_id,
          req.user.id,
        ]
      );

      return res.status(201).json({
        message: "Created post successfully",
        id: result.rows[0].id,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Server could not create post",
        error: err.message,
      });
    }
  }
);

export default postRouter;
