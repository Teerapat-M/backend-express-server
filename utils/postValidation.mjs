/**
 * Validation ของ Create / Update Post
 *
 * ไฟล์นี้: utils/postValidation.mjs
 * ฟังก์ชันที่ต่อกับ endpoint:
 *   - validateCreatePost  → POST /posts
 *   - validateUpdatePost  → PUT /posts/:postId
 *
 * ข้อมูลผิดจะถูก reject เป็น 400 ก่อนเข้า handler (ทดสอบด้วย Postman ได้)
 */

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function isBlank(value) {
  return value === undefined || value === null || value === "";
}

function requireString(value, fieldName) {
  if (isBlank(value)) {
    return `${fieldName} is required`;
  }
  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }
  if (value.trim() === "") {
    return `${fieldName} is required`;
  }
  return null;
}

function requireNumber(value, fieldName) {
  if (isBlank(value)) {
    return { error: `${fieldName} is required` };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { value };
  }

  // FormData ส่งทุกฟิลด์เป็น string — แปลงได้เฉพาะค่าที่เป็นตัวเลข
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return { value: parsed };
    }
  }

  return { error: `${fieldName} must be a number` };
}

export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return "Please upload a valid image file (JPEG, PNG, GIF, WebP).";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "The file is too large. Please upload an image smaller than 5MB.";
  }
  return null;
}

function validatePostFields(req, { allowImageFile }) {
  const { title, image, category_id, description, content, status_id } =
    req.body;
  const imageFile = req.files?.imageFile?.[0];

  const titleError = requireString(title, "Title");
  if (titleError) return titleError;

  if (allowImageFile && imageFile) {
    const fileError = validateImageFile(imageFile);
    if (fileError) return fileError;
  } else {
    const imageError = requireString(image, "Image");
    if (imageError) return imageError;
  }

  const category = requireNumber(category_id, "Category id");
  if (category.error) return category.error;

  const descriptionError = requireString(description, "Description");
  if (descriptionError) return descriptionError;

  const contentError = requireString(content, "Content");
  if (contentError) return contentError;

  const status = requireNumber(status_id, "Status id");
  if (status.error) return status.error;

  req.body.title = title.trim();
  req.body.description = description.trim();
  req.body.content = content.trim();
  if (typeof image === "string") {
    req.body.image = image.trim();
  }
  req.body.category_id = category.value;
  req.body.status_id = status.value;

  return null;
}

/** POST /posts — รับได้ทั้ง JSON (image เป็น URL) และ multipart (imageFile) */
export function validateCreatePost(req, res, next) {
  const message = validatePostFields(req, { allowImageFile: true });
  if (message) {
    return res.status(400).json({ message });
  }
  next();
}

/** PUT /posts/:postId — ต้องส่ง image เป็น URL string */
export function validateUpdatePost(req, res, next) {
  const message = validatePostFields(req, { allowImageFile: false });
  if (message) {
    return res.status(400).json({ message });
  }
  next();
}

/** alias เดิมที่ใช้กับ POST /assignments */
export const validatePostBody = validateUpdatePost;
