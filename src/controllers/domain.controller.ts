import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { generateSlug } from "../lib/utils.js";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";

export const listDomains = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { published } = req.query;
    const where: Record<string, unknown> = {};

    if (req.user!.role === "CREATOR") {
      where.creatorId = req.user!.id;
    }
    if (published !== undefined) {
      where.published = published === "true";
    }

    const domains = await prisma.domain.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        iconUrl: true,
        bannerUrl: true,
        published: true,
        isFeatured: true,
        priceINR: true,
        priceMYR: true,
        isFree: true,
        durationOptions: true,
        createdAt: true,
        _count: { select: { sections: true, tasks: true, enrollments: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: domains });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch domains" });
  }
};

export const createDomain = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const {
      title,
      description,
      iconUrl,
      bannerUrl,
      priceINR,
      priceMYR,
      isFree,
      durationOptions,
    } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }

    const slug = await generateSlug(title);

    const domain = await prisma.domain.create({
      data: {
        title,
        slug,
        description,
        iconUrl,
        bannerUrl,
        priceINR: priceINR ? parseFloat(priceINR) : null,
        priceMYR: priceMYR ? parseFloat(priceMYR) : null,
        isFree: isFree ?? false,
        durationOptions: durationOptions ?? [1, 3],
        creatorId: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: domain });
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ success: false, message: "Slug already exists" });
      return;
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create domain" });
  }
};

export const getDomain = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        sections: {
          orderBy: { orderIndex: "asc" },
          include: {
            lessons: { orderBy: { orderIndex: "asc" } },
          },
        },
        tasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: { options: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!domain) {
      res.status(404).json({ success: false, message: "Domain not found" });
      return;
    }

    if (req.user!.role === "CREATOR" && domain.creatorId !== req.user!.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    res.json({ success: true, data: domain });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch domain" });
  }
};

export const updateDomain = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params["id"] as string;
    const domain = await prisma.domain.findUnique({
      where: { id },
    });
    if (!domain) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }
    if (req.user!.role === "CREATOR" && domain.creatorId !== req.user!.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const {
      title,
      description,
      iconUrl,
      bannerUrl,
      priceINR,
      priceMYR,
      isFree,
      durationOptions,
      isFeatured,
    } = req.body;

    const updated = await prisma.domain.update({
      where: { id},
      data: {
        ...(title && {
          title,
          slug: await generateSlug(title, id),
        }),
        description,
        iconUrl,
        bannerUrl,
        isFeatured,
        priceINR: priceINR !== undefined ? parseFloat(priceINR) : undefined,
        priceMYR: priceMYR !== undefined ? parseFloat(priceMYR) : undefined,
        isFree,
        durationOptions,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update domain" });
  }
};

export const deleteDomain = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params["id"] as string;
    await prisma.domain.delete({ where: { id }});
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete domain" });
  }
};

export const togglePublish = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const id = req.params["id"] as string;
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: { _count: { select: { sections: true, tasks: true } } },
    });

    if (!domain) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }

    if (!domain.published && domain._count.sections === 0) {
      res.status(400).json({
        success: false,
        message: "Cannot publish: add at least one section with lessons first",
      });
      return;
    }

    const updated = await prisma.domain.update({
      where: { id },
      data: { published: !domain.published },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to toggle publish" });
  }
};
