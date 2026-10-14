const express = require("express");

const { getCurrentUser, updatePassword, deleteMe, updateMe, lookupUserByEmail } = require("../controllers/userController");
const protect = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", protect, getCurrentUser);
router.post("/updatePassword", protect, updatePassword);
router.delete("/deleteMe", protect, deleteMe);
router.patch("/updateMe", protect, updateMe);
router.post("/lookup-by-email", protect, lookupUserByEmail);

module.exports = router;
