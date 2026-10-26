import { Router } from "express";
import multer from "multer";
import supabase from "../utils/supabase.mjs";
import connectionPool from "../utils/db.mjs";
import protectUser from "../middlewares/protectUser.mjs";
import { uploadBlogFile } from "../utils/storage.mjs";
import { validateImageFile } from "../utils/postValidation.mjs";

const authRouter = Router();
const imageFileUpload = multer({ storage: multer.memoryStorage() }).fields([
  { name: "imageFile", maxCount: 1 },
]);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    profilePic: user.profilePic,
  };
}

authRouter.post("/register", async (req, res) => {
  const { email, password, username, name } = req.body;
  try {
    const { rows: existingUser } = await connectionPool.query(
      `SELECT id FROM users WHERE username = $1`,
      [username]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }

    const { data, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (supabaseError) {
      if (supabaseError.code === "user_already_exists") {
        return res
          .status(400)
          .json({ error: "User with this email already exists" });
      }
      return res
        .status(400)
        .json({ error: "Failed to create user. Please try again." });
    }

    const { rows } = await connectionPool.query(
      `INSERT INTO users (id, username, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.user.id, username, name, "user"]
    );
    res.status(201).json({
      message: "User created successfully",
      user: rows[0],
    });
  } catch {
    res.status(500).json({ error: "An error occurred during registration" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(200).json({
      message: "User has been signed in successfully",
      access_token: data.session.access_token,
      user: data.user,
    });
  } catch {
    return res.status(500).json({
      message:
        "Server could not sign in user because of a database connection error",
    });
  }
});

authRouter.get("/get-user", protectUser, async (req, res) => {
  return res.status(200).json(publicUser(req.user));
});

authRouter.put(
  "/update-profile",
  imageFileUpload,
  protectUser,
  async (req, res) => {
    const { name, username } = req.body;
    const file = req.files?.imageFile?.[0];

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
        return res.status(400).json({
          error: "Name cannot be empty or exceed 100 characters",
        });
      }
    }
    if (username !== undefined) {
      if (
        typeof username !== "string" ||
        username.trim() === "" ||
        username.length > 50
      ) {
        return res.status(400).json({
          error: "Username cannot be empty or exceed 50 characters",
        });
      }
    }
    if (file) {
      const fileError = validateImageFile(file);
      if (fileError) {
        return res.status(400).json({ error: fileError });
      }
    }
    if (name === undefined && username === undefined && !file) {
      return res.status(400).json({ error: "No fields to update provided" });
    }

    try {
      let profilePicUrl;
      if (file) {
        profilePicUrl = await uploadBlogFile(
          `profiles/${req.user.id}-${Date.now()}`,
          file
        );
      }

      if (username && username.trim() !== req.user.username) {
        const { rows: taken } = await connectionPool.query(
          `SELECT id FROM users WHERE username = $1 AND id <> $2`,
          [username.trim(), req.user.id]
        );
        if (taken.length > 0) {
          return res
            .status(400)
            .json({ error: "This username is already taken" });
        }
      }

      const fields = [];
      const values = [];
      let i = 1;
      if (name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(name.trim());
      }
      if (username !== undefined) {
        fields.push(`username = $${i++}`);
        values.push(username.trim());
      }
      if (profilePicUrl) {
        fields.push(`profile_pic = $${i++}`);
        values.push(profilePicUrl);
      }
      values.push(req.user.id);

      const { rows } = await connectionPool.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}
         RETURNING username, name, role, profile_pic`,
        values
      );

      return res.status(200).json(
        publicUser({
          id: req.user.id,
          email: req.user.email,
          username: rows[0].username,
          name: rows[0].name,
          role: rows[0].role,
          profilePic: rows[0].profile_pic,
        })
      );
    } catch {
      return res.status(500).json({ error: "Failed to update profile" });
    }
  }
);

authRouter.put("/reset-password", protectUser, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: "New password is required" });
  }
  try {
    const token = req.headers.authorization.split(" ")[1];
    const { data: userData } = await supabase.auth.getUser(token);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: oldPassword,
    });
    if (loginError) {
      return res.status(400).json({ error: "Invalid old password" });
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ message: "Password updated successfully" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default authRouter;
