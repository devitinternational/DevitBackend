import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const listPublicDomains = async (_req: Request, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      where: { published: true },
      select: {
        id: true, title: true, slug: true, description: true,
        iconUrl: true, bannerUrl: true, isFeatured: true,
        priceINR: true, isFree: true, durationOptions: true,
        _count: { select: { sections: true, tasks: true, enrollments: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, data: domains });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch domains" });
  }
};

const domainSelect = {
  id: true, title: true, slug: true, description: true,
  iconUrl: true, bannerUrl: true, isFeatured: true,
  priceINR: true, isFree: true, durationOptions: true,
  sections: {
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true, title: true, description: true, orderIndex: true,
      lessons: {
        orderBy: { orderIndex: "asc" as const },
        select: {
          id: true, title: true, contentType: true,
          isFree: true, videoDurationSeconds: true,
        },
      },
    },
  },
  tasks: {
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true, title: true, taskType: true,
      orderIndex: true, isRequired: true,
    },
  },
  _count: { select: { sections: true, tasks: true, enrollments: true } },
};

export const getPublicDomain = async (req: Request, res: Response) => {
  try {
    const idOrSlug = req.params.idOrSlug as string;

    // Try id first, then slug — avoids Prisma OR type conflict
    let domain = await prisma.domain.findFirst({
      where: { published: true, id: idOrSlug },
      select: domainSelect,
    });

    if (!domain) {
      domain = await prisma.domain.findFirst({
        where: { published: true, slug: idOrSlug },
        select: domainSelect,
      });
    }

    if (!domain) {
      res.status(404).json({ success: false, message: "Domain not found" });
      return;
    }

    res.json({ success: true, data: domain });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch domain" });
  }
};