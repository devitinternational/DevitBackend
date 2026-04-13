import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
 
export const createTask = async (req: Request, res: Response) => {
  try {
    const domainId = req.params["domainId"] as string;
    const { title, description, taskType, isRequired, passingScore } = req.body;
 
    if (!title || !taskType) {
      return res.status(400).json({ success: false, message: "Title and taskType required" });
    }
    if (!["PROJECT", "QUIZ"].includes(taskType)) {
      return res.status(400).json({ success: false, message: "taskType must be PROJECT or QUIZ" });
    }
    if (taskType === "QUIZ" && passingScore !== undefined) {
      if (passingScore < 0 || passingScore > 100) {
        return res.status(400).json({ success: false, message: "passingScore must be 0-100" });
      }
    }
 
    const count = await prisma.task.count({ where: { domainId } });
 
    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        domainId,
        orderIndex: count,
        isRequired: isRequired ?? true,
        passingScore: taskType === "QUIZ" ? (passingScore ?? 70) : null,
      },
      include: { questions: { include: { options: true } } },
    });
 
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create task" });
  }
};
 
export const updateTask = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const { title, description, isRequired, passingScore } = req.body;
    const task = await prisma.task.update({
      where: { id },
      data: { title, description, isRequired, passingScore },
      include: { questions: { include: { options: true } } },
    });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update task" });
  }
};
 
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete task" });
  }
};
 
export const reorderTasks = async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: { id: string; orderIndex: number }[] };
    await prisma.$transaction(
      items.map((item) =>
        prisma.task.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } })
      )
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reorder tasks" });
  }
};
 
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const taskId = req.params["taskId"] as string;
    const { question, explanation, options } = req.body;
    // options: [{ text: string, isCorrect: boolean }]
 
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ success: false, message: "Question and at least 2 options required" });
    }
    const hasCorrect = options.some((o: { isCorrect: boolean }) => o.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({ success: false, message: "At least one option must be marked correct" });
    }
 
    const count = await prisma.quizQuestion.count({ where: { taskId} });
 
    const q = await prisma.quizQuestion.create({
      data: {
        question,
        explanation,
        taskId,
        orderIndex: count,
        options: {
          create: options.map((o: { text: string; isCorrect: boolean }, i: number) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            orderIndex: i,
          })),
        },
      },
      include: { options: true },
    });
 
    res.status(201).json({ success: true, data: q });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add question" });
  }
};
 
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const { question, explanation, options } = req.body;
 
    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quizQuestion.update({
        where: { id },
        data: { question, explanation },
      });
      if (options) {
        await tx.quizOption.deleteMany({ where: { questionId: q.id } });
        await tx.quizOption.createMany({
          data: options.map((o: { text: string; isCorrect: boolean }, i: number) => ({
            questionId: q.id,
            text: o.text,
            isCorrect: o.isCorrect,
            orderIndex: i,
          })),
        });
      }
      return tx.quizQuestion.findUnique({ where: { id: q.id }, include: { options: true } });
    });
 
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update question" });
  }
};
 
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    await prisma.quizQuestion.delete({ where: { id } });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete question" });
  }
};