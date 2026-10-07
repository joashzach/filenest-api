const express = require("express");
const protect = require("../middlewares/authMiddleware");

const {
  generateUploadUrl,
  confirmUpload,
  generateDownloadUrl,
  getAllFiles,
  getFile,
  deleteFile,
  moveFile,
} = require("../controllers/fileController");

const router = express.Router();

router.post("/upload-url", protect, generateUploadUrl);
router.post("/upload-confirm", protect, confirmUpload);
router.get("/download-url/:id", protect, generateDownloadUrl);
router.get("/", protect, getAllFiles);
router.route("/:id").get(protect, getFile).delete(protect, deleteFile);
router.patch("/:id/move", protect, moveFile);

module.exports = router;
