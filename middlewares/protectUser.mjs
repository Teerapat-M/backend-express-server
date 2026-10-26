import supabase from "../utils/supabase.mjs";
import connectionPool from "../utils/db.mjs";

export function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function loadAppUser(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { status: 401, body: { error: "Unauthorized: Invalid token" } };
  }

  const { rows } = await connectionPool.query(
    `select username, name, role, profile_pic from users where id = $1`,
    [data.user.id]
  );
  if (!rows.length) {
    return { status: 404, body: { error: "User role not found" } };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      username: rows[0].username,
      name: rows[0].name,
      role: rows[0].role,
      profilePic: rows[0].profile_pic,
    },
  };
}

const protectUser = async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }
  try {
    const result = await loadAppUser(token);
    if (!result.user) {
      return res.status(result.status).json(result.body);
    }
    req.user = result.user;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export async function optionalUser(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const result = await loadAppUser(token);
    if (!result.user) {
      return res.status(result.status).json(result.body);
    }
    req.user = result.user;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export default protectUser;
