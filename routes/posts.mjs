import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { validateUpdatePost } from "../utils/postValidation.mjs";
import protectUser, { optionalUser } from "../middlewares/protectUser.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const postsRouter = Router();

const POST_SELECT = `
  posts.id,
  posts.image,
  categories.name as category,
  posts.title,
  posts.description,
  posts.date,
  posts.content,
  statuses.status,
  posts.likes_count,
  authors.name as author_name,
  authors.username as author_username,
  authors.profile_pic as author_profile_pic
`;

const POST_FROM = `
  from posts
  inner join categories on posts.category_id = categories.id
  inner join statuses on posts.status_id = statuses.id
  left join users authors on authors.id = posts.user_id
`;

function shapePost(row) {
  return {
    id: row.id,
    image: row.image,
    category: row.category,
    title: row.title,
    description: row.description,
    date: row.date,
    content: row.content,
    status: row.status,
    likes_count: row.likes_count,
    author: {
      name: row.author_name,
      username: row.author_username,
      profilePic: row.author_profile_pic,
    },
  };
}

function applyStatusFilter(req, values) {
  if (req.user?.role === "admin" && req.query.status === "all") {
    return "";
  }
  if (req.user?.role === "admin" && req.query.status === "draft") {
    values.push(1);
    return ` and posts.status_id = $${values.length}`;
  }
  values.push(2);
  return ` and posts.status_id = $${values.length}`;
}

async function likeState(postId, userId) {
  const { rows } = await connectionPool.query(
    `select posts.likes_count,
            exists(
              select 1 from likes
              where likes.post_id = posts.id and likes.user_id = $2
            ) as liked
     from posts
     where posts.id = $1`,
    [postId, userId]
  );
  return rows[0] ?? null;
}

postsRouter.get("/", optionalUser, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 6;
    const category = req.query.category;
    const keyword = req.query.keyword;
    const offset = (page - 1) * limit;

    const values = [];
    let whereClause = "where 1=1";
    whereClause += applyStatusFilter(req, values);

    if (category) {
      values.push(category);
      whereClause += ` and categories.name = $${values.length}`;
    }

    if (keyword) {
      values.push(`%${keyword}%`);
      const keywordIndex = values.length;
      whereClause += ` and (posts.title ilike $${keywordIndex} or posts.description ilike $${keywordIndex} or posts.content ilike $${keywordIndex})`;
    }

    const countResult = await connectionPool.query(
      `select count(*) from posts
       inner join categories on posts.category_id = categories.id
       inner join statuses on posts.status_id = statuses.id
       ${whereClause}`,
      values
    );

    const totalPosts = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPosts / limit) || 0;

    const postsResult = await connectionPool.query(
      `select ${POST_SELECT}
       ${POST_FROM}
       ${whereClause}
       order by posts.date desc
       limit $${values.length + 1}
       offset $${values.length + 2}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      totalPosts,
      totalPages,
      currentPage: page,
      limit,
      posts: postsResult.rows.map(shapePost),
      nextPage: page < totalPages ? page + 1 : null,
    });
  } catch {
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
});

postsRouter.get("/:postId/comments", async (req, res) => {
  const postId = req.params.postId;
  try {
    const post = await connectionPool.query(
      `select id from posts where id = $1`,
      [postId]
    );
    if (!post.rows[0]) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    const { rows } = await connectionPool.query(
      `select
         comments.id,
         comments.post_id,
         comments.user_id,
         comments.comment_text,
         comments.created_at,
         users.name,
         users.username,
         users.profile_pic
       from comments
       inner join users on comments.user_id = users.id
       where comments.post_id = $1
       order by comments.created_at desc`,
      [postId]
    );

    return res.status(200).json(
      rows.map((row) => ({
        id: row.id,
        post_id: row.post_id,
        user_id: row.user_id,
        comment_text: row.comment_text,
        created_at: row.created_at,
        name: row.name,
        username: row.username,
        profilePic: row.profile_pic,
      }))
    );
  } catch {
    return res.status(500).json({
      message: "Server could not read comments because database connection",
    });
  }
});

postsRouter.post("/:postId/comments", protectUser, async (req, res) => {
  const postId = req.params.postId;
  const comment =
    typeof req.body.comment === "string" ? req.body.comment.trim() : "";

  if (!comment) {
    return res.status(400).json({ message: "Comment content cannot be empty" });
  }
  if (comment.length > 500) {
    return res.status(400).json({
      message: "Comment content exceeds the maximum length of 500 characters",
    });
  }

  try {
    const post = await connectionPool.query(
      `select id from posts where id = $1`,
      [postId]
    );
    if (!post.rows[0]) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    const { rows } = await connectionPool.query(
      `insert into comments (post_id, user_id, comment_text)
       values ($1, $2, $3)
       returning id, post_id, user_id, comment_text, created_at`,
      [postId, req.user.id, comment]
    );

    const created = rows[0];
    return res.status(201).json({
      id: created.id,
      post_id: created.post_id,
      user_id: created.user_id,
      comment_text: created.comment_text,
      created_at: created.created_at,
      name: req.user.name,
      username: req.user.username,
      profilePic: req.user.profilePic,
    });
  } catch {
    return res.status(500).json({
      message: "Server could not create comment due to a database connection issue",
    });
  }
});

postsRouter.post("/:postId/likes", protectUser, async (req, res) => {
  const postId = req.params.postId;
  try {
    const state = await likeState(postId, req.user.id);
    if (!state) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    await connectionPool.query(
      `insert into likes (post_id, user_id) values ($1, $2)
       on conflict (post_id, user_id) do nothing`,
      [postId, req.user.id]
    );

    const next = await likeState(postId, req.user.id);
    return res.status(201).json({
      likes_count: next.likes_count,
      liked: true,
    });
  } catch {
    return res.status(500).json({
      message: "Server could not create like because of a database connection issue",
    });
  }
});

postsRouter.delete("/:postId/likes", protectUser, async (req, res) => {
  const postId = req.params.postId;
  try {
    const state = await likeState(postId, req.user.id);
    if (!state) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    await connectionPool.query(
      `delete from likes where post_id = $1 and user_id = $2`,
      [postId, req.user.id]
    );

    const next = await likeState(postId, req.user.id);
    return res.status(200).json({
      likes_count: next.likes_count,
      liked: false,
    });
  } catch {
    return res.status(500).json({
      message: "Server could not delete like due to a database connection issue",
    });
  }
});

postsRouter.get("/:postId", optionalUser, async (req, res) => {
  const postId = req.params.postId;
  const values = [postId];
  let extra = "";
  if (req.user?.role !== "admin") {
    values.push(2);
    extra = ` and posts.status_id = $2`;
  }

  try {
    const result = await connectionPool.query(
      `select ${POST_SELECT}
       ${POST_FROM}
       where posts.id = $1${extra}`,
      values
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    return res.status(200).json(shapePost(result.rows[0]));
  } catch {
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
});

postsRouter.put(
  "/:postId",
  validateUpdatePost,
  protectAdmin,
  async (req, res) => {
    const postId = req.params.postId;
    const { title, image, category_id, description, content, status_id } =
      req.body;

    try {
      const result = await connectionPool.query(
        `update posts
         set title = $2,
             image = $3,
             category_id = $4,
             description = $5,
             content = $6,
             status_id = $7
         where id = $1`,
        [postId, title, image, category_id, description, content, status_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Server could not find a requested post to update",
        });
      }

      return res.status(200).json({
        message: "Updated post sucessfully",
      });
    } catch {
      return res.status(500).json({
        message: "Server could not update post because database connection",
      });
    }
  }
);

postsRouter.delete("/:postId", protectAdmin, async (req, res) => {
  const postId = req.params.postId;

  try {
    const result = await connectionPool.query(
      `delete from posts where id = $1`,
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to delete",
      });
    }

    return res.status(200).json({
      message: "Deleted post sucessfully",
    });
  } catch {
    return res.status(500).json({
      message: "Server could not delete post because database connection",
    });
  }
});

export default postsRouter;
