import protectUser from "./protectUser.mjs";

const protectAdmin = async (req, res, next) => {
  await protectUser(req, res, () => {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have admin access" });
    }
    next();
  });
};

export default protectAdmin;
