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
  renameFile,
  shareFile,
  removeFileShare,
  sharedWithMe,
  getFileShareGrants,
  leaveFileShare,
  sharedByMe,
} = require("../controllers/fileController");

const router = express.Router();

router.post("/upload-url", protect, generateUploadUrl);
router.post("/upload-confirm", protect, confirmUpload);
router.get("/download-url/:id", protect, generateDownloadUrl);
router.get("/shared-with-me", protect, sharedWithMe);
router.get("/shared-by-me", protect, sharedByMe);
router.get("/", protect, getAllFiles);
router.route("/:id").get(protect, getFile).delete(protect, deleteFile);
router.patch("/:id/move", protect, moveFile);
router.patch("/:id/rename", protect, renameFile);
// Share management (MUST be before /:fileId/share/:userId to avoid param conflicts)
router.get("/:fileId/share", protect, getFileShareGrants);
router.post("/:fileId/share", protect, shareFile);
router.delete("/:fileId/share/me", protect, leaveFileShare);
router.delete("/:fileId/share/:userId", protect, removeFileShare);

module.exports = router;
