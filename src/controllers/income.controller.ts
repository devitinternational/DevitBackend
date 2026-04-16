import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";
import {
  getExchangeRates,
  convertINRtoMYR,
  convertMYRtoINR,
} from "../services/currency.service.js";
import { Decimal } from "decimal.js";

export async function GetAllIncomes(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const incomes = await prisma.income.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: "desc" },
    });
    res.json({ incomes });
  } catch (err) {
    console.error("GetAllIncomes error:", err);
    res.status(500).json({ error: "Failed to fetch incomes" });
  }
}

export async function GetIncomeById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"] as string;

    const income = await prisma.income.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!income) {
      res.status(404).json({ error: "Income not found" });
      return;
    }

    res.json({ income });
  } catch (err) {
    console.error("GetIncomeById error:", err);
    res.status(500).json({ error: "Failed to fetch income" });
  }
}

export async function CreateIncome(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      title,
      category,
      description,
      date,
      amountINR,
      amountMYR,
      inputCurrency,
    } = req.body;

    if (!title || !category || !date) {
      res.status(400).json({ error: "title, category and date are required" });
      return;
    }

    if (!amountINR && !amountMYR) {
      res
        .status(400)
        .json({ error: "Either amountINR or amountMYR is required" });
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

    const income = await prisma.income.create({
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

    res.status(201).json({ income });
  } catch (err) {
    console.error("CreateIncome error:", err);
    res.status(500).json({ error: "Failed to create income" });
  }
}

export async function UpdateIncome(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"] as string;
    const {
      title,
      category,
      description,
      date,
      amountINR,
      amountMYR,
      inputCurrency,
    } = req.body;

    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Income not found" });
      return;
    }

    let updatedINR: Decimal = existing.amountINR;
    let updatedMYR: Decimal = existing.amountMYR;

    if (amountINR || amountMYR) {
      const rates = await getExchangeRates();

      if (inputCurrency === "MYR") {
        updatedMYR = new Decimal(Number(amountMYR));
        updatedINR = new Decimal(
          convertMYRtoINR(Number(amountMYR), rates.MYR_TO_INR),
        );
      } else {
        updatedINR = new Decimal(Number(amountINR));
        updatedMYR = new Decimal(
          convertINRtoMYR(Number(amountINR), rates.INR_TO_MYR),
        );
      }
    }

    const income = await prisma.income.update({
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

    res.json({ income });
  } catch (err) {
    console.error("UpdateIncome error:", err);
    res.status(500).json({ error: "Failed to update income" });
  }
}

export async function DeleteIncome(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"] as string;

    const existing = await prisma.income.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Income not found" });
      return;
    }

    await prisma.income.delete({ where: { id } });
    res.json({ message: "Income deleted successfully" });
  } catch (err) {
    console.error("DeleteIncome error:", err);
    res.status(500).json({ error: "Failed to delete income" });
  }
}

export async function GetFinanceReport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { from, to, category, minAmount, maxAmount } = req.query;

    const dateFilter = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to ? { lte: new Date(to as string) } : {}),
    };

    const amountFilter = {
      ...(minAmount ? { gte: new Decimal(Number(minAmount)) } : {}),
      ...(maxAmount ? { lte: new Decimal(Number(maxAmount)) } : {}),
    };

    const baseWhere = {
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      ...(Object.keys(amountFilter).length ? { amountINR: amountFilter } : {}),
      ...(category ? { category: category as string } : {}),
    };

    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({
        where: baseWhere,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.income.findMany({
        where: baseWhere,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    const totalExpensesINR = expenses.reduce(
      (sum, e) => sum + Number(e.amountINR ?? 0),
      0,
    );
    const totalExpensesMYR = expenses.reduce(
      (sum, e) => sum + Number(e.amountMYR ?? 0),
      0,
    );
    const totalIncomeINR = incomes.reduce(
      (sum, i) => sum + Number(i.amountINR ?? 0),
      0,
    );
    const totalIncomeMYR = incomes.reduce(
      (sum, i) => sum + Number(i.amountMYR ?? 0),
      0,
    );

    const netINR = totalIncomeINR - totalExpensesINR;
    const netMYR = totalIncomeMYR - totalExpensesMYR;

    const expenseByCategory = expenses.reduce(
      (acc: Record<string, { INR: number; MYR: number }>, e) => {
        if (!acc[e.category]) acc[e.category] = { INR: 0, MYR: 0 };
        acc[e.category]!.INR += Number(e.amountINR ?? 0);
        acc[e.category]!.MYR += Number(e.amountMYR ?? 0);
        return acc;
      },
      {},
    );

    const incomeByCategory = incomes.reduce(
      (acc: Record<string, { INR: number; MYR: number }>, i) => {
        if (!acc[i.category]) acc[i.category] = { INR: 0, MYR: 0 };
        acc[i.category]!.INR += Number(i.amountINR ?? 0);
        acc[i.category]!.MYR += Number(i.amountMYR ?? 0);
        return acc;
      },
      {},
    );

    res.json({
      expenses,
      incomes,
      summary: {
        totalExpensesINR,
        totalExpensesMYR,
        totalIncomeINR,
        totalIncomeMYR,
        netINR,
        netMYR,
        expenseCount: expenses.length,
        incomeCount: incomes.length,
        expenseByCategory,
        incomeByCategory,
      },
    });
  } catch (err) {
    console.error("GetFinanceReport error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
}
