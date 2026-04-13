import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";
import { getExchangeRates, convertINRtoMYR, convertMYRtoINR } from "../services/currency.service.js";
import { Decimal } from "decimal.js";

export async function GetAllExpenses(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: "desc" },
    });
    res.json({ expenses });
  } catch (err) {
    console.error("GetAllExpenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
}

export async function GetExpenseById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"] as string;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    res.json({ expense });
  } catch (err) {
    console.error("GetExpenseById error:", err);
    res.status(500).json({ error: "Failed to fetch expense" });
  }
}

export async function CreateExpense(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { title, category, description, date, amountINR, amountMYR, inputCurrency } = req.body;

    if (!title || !category || !date) {
      res.status(400).json({ error: "title, category and date are required" });
      return;
    }

    if (!amountINR && !amountMYR) {
      res.status(400).json({ error: "Either amountINR or amountMYR is required" });
      return;
    }

    const rates = await getExchangeRates();

    let finalINR: number;
    let finalMYR: number;

    if (inputCurrency === "MYR") {
      finalMYR = Number(amountMYR);
      finalINR = convertMYRtoINR(finalMYR, rates.MYR_TO_INR);
    } else {
      finalINR = Number(amountINR);
      finalMYR = convertINRtoMYR(finalINR, rates.INR_TO_MYR);
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        description: description ?? null,
        date: new Date(date),
        amountINR: new Decimal(finalINR),
        amountMYR: new Decimal(finalMYR),
        createdById: req.user!.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ expense });
  } catch (err) {
    console.error("CreateExpense error:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
}

export async function UpdateExpense(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"] as string;
    const { title, category, description, date, amountINR, amountMYR, inputCurrency } = req.body;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    let updatedINR: Decimal = existing.amountINR;
    let updatedMYR: Decimal = existing.amountMYR;

    if (amountINR || amountMYR) {
      const rates = await getExchangeRates();

      if (inputCurrency === "MYR") {
        updatedMYR = new Decimal(Number(amountMYR));
        updatedINR = new Decimal(convertMYRtoINR(Number(amountMYR), rates.MYR_TO_INR));
      } else {
        updatedINR = new Decimal(Number(amountINR));
        updatedMYR = new Decimal(convertINRtoMYR(Number(amountINR), rates.INR_TO_MYR));
      }
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date as string) }),
        amountINR: updatedINR,
        amountMYR: updatedMYR,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ expense });
  } catch (err) {
    console.error("UpdateExpense error:", err);
    res.status(500).json({ error: "Failed to update expense" });
  }
}

export async function DeleteExpense(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"] as string;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    await prisma.expense.delete({ where: { id } });
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("DeleteExpense error:", err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
}

export async function GetExpenseReport(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { from, to, category } = req.query;

    const expenses = await prisma.expense.findMany({
      where: {
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
        ...(category ? { category: category as string } : {}),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: "desc" },
    });

    const totalINR = expenses.reduce((sum, e) => sum + Number(e.amountINR), 0);
    const totalMYR = expenses.reduce((sum, e) => sum + Number(e.amountMYR), 0);

    const byCategory = expenses.reduce((acc: Record<string, { INR: number; MYR: number }>, e) => {
      if (!acc[e.category]) acc[e.category] = { INR: 0, MYR: 0 };
      acc[e.category]!.INR += Number(e.amountINR);
      acc[e.category]!.MYR += Number(e.amountMYR);
      return acc;
    }, {});

    res.json({
      expenses,
      summary: {
        totalINR,
        totalMYR,
        count: expenses.length,
        byCategory,
      },
    });
  } catch (err) {
    console.error("GetExpenseReport error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
}