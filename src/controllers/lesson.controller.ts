import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getPresignedUploadUrl } from "../lib/storage.js";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";

export const createLesson = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const sectionId = req.params["sectionId"] as string;
    const {
      title,
      description,
      contentType,
      externalUrl,
      articleContent,
      isFree,
      videoDurationSeconds,
    } = req.body;

    if (!title || !contentType) {
      res
        .status(400)
        .json({ success: false, message: "Title and contentType required" });
      return;
    }

    const validTypes = ["VIDEO_UPLOAD", "EXTERNAL_VIDEO", "ARTICLE"];
    if (!validTypes.includes(contentType)) {
      res
        .status(400)
        .json({
          success: false,
          message: `contentType must be one of ${validTypes.join(", ")}`,
        });
      return;
    }

    const count = await prisma.lesson.count({ where: { sectionId } });

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        contentType,
        sectionId,
        orderIndex: count,
        externalUrl: contentType === "EXTERNAL_VIDEO" ? externalUrl : null,
        articleContent: contentType === "ARTICLE" ? articleContent : null,
        videoDurationSeconds: videoDurationSeconds ?? null,
        isFree: isFree ?? false,
      },
    });

    res.status(201).json({ success: true, data: lesson });
  } catch (err) {
    console.error("createLesson error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to create lesson" });
  }
};

export const updateLesson = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params["lessonId"] as string;
    const {
      title,
      description,
      externalUrl,
      articleContent,
      isFree,
      videoKey,
      videoDurationSeconds,
    } = req.body;

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        title,
        description,
        externalUrl,
        articleContent,
        isFree,
        videoKey,
        videoDurationSeconds,
      },
    });

    res.json({ success: true, data: lesson });
  } catch (err) {
    console.error("updateLesson error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update lesson" });
  }
};

export const deleteLesson = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params["lessonId"] as string;
    await prisma.lesson.delete({ where: { id } });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteLesson error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete lesson" });
  }
};

export const reorderLessons = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { items } = req.body as {
      items: { id: string; orderIndex: number }[];
    };

    await prisma.$transaction(
      items.map((item) =>
        prisma.lesson.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        }),
      ),
    );

    res.json({ success: true });
  } catch (err) {
    console.error("reorderLessons error:", err);
    res.status(500).json({ success: false, message: "Failed to reorder" });
  }
};

export const getVideoUploadUrl = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const lessonId = req.params["lessonId"] as string;
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      res
        .status(400)
        .json({ success: false, message: "filename and contentType required" });
      return;
    }

    const key = `lessons/${lessonId}/${Date.now()}-${filename}`;
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      key,
      contentType,
    );

    res.json({ success: true, data: { uploadUrl, publicUrl, key } });
  } catch (err: any) {
    console.error("R2 upload URL error:", err.message, err); // add this
    res
      .status(500)
      .json({ success: false, message: "Failed to generate upload URL" });
  }
};
