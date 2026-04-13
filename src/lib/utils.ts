import slugify from "slugify";
import { prisma } from "./prisma";
 
export async function generateSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true });
  let slug = base;
  let counter = 1;
 
  while (true) {
    const existing = await prisma.domain.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${counter++}`;
  }
 
  return slug;
}