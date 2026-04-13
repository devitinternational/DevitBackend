import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
 
export const createSection = async (req: Request, res: Response) => {
  try {
    const domainId = req.params["domainId"] as string;
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ success: false, message: "Title required" });
 
    const count = await prisma.section.count({ where: { domainId } });
 
    const section = await prisma.section.create({
      data: {
        title,
        description,
        domainId,
        orderIndex: count,
      },
      include: { lessons: true },
    });
 
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create section" });
  }
};
 
export const updateSection = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const section = await prisma.section.update({
      where: { id },
      data: { title: req.body.title, description: req.body.description },
    });
    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update section" });
  }
};
 
export const deleteSection = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    await prisma.section.delete({ where: { id } });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete section" });
  }
};
 
export const reorderSections = async (req: Request, res: Response) => {
  try {
    // body: { items: [{ id: string, orderIndex: number }] }
    const { items } = req.body as { items: { id: string; orderIndex: number }[] };
    await prisma.$transaction(
      items.map((item) =>
        prisma.section.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } })
      )
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reorder" });
  }
};