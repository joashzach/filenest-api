const express = require("express");

const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const fileRoutes = require("./fileRoutes");
const folderRoutes = require("./folderRoutes")

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/files", fileRoutes);
router.use("/folders", folderRoutes);

module.exports = router;
