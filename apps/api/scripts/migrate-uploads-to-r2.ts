/**
 * Copies every existing image into Cloudflare R2 so all media lives there:
 *   - files committed under apps/api/uploads (seeded catalogue, early uploads)
 *   - images stored in Postgres (StoredImage) before R2 was configured
 *
 * Keys mirror the public URL (`/uploads/products/a.jpg` → `uploads/products/a.jpg`),
 * so no database URL has to change. Safe to re-run: objects already in the
 * bucket are skipped.
 *
 *   npx tsx scripts/migrate-uploads-to-r2.ts
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { objectExists, putObject, r2Configured, uploadKey } from '../src/lib/objectStorage';
import { UPLOADS_DIR } from '../src/lib/mediaStore';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && !entry.name.startsWith('.') ? [full] : [];
  });
}

async function main() {
  if (!r2Configured) throw new Error('Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET first');
  const prisma = new PrismaClient();
  const counts = { disk: 0, database: 0, alreadyThere: 0, skippedUnknownType: 0 };

  for (const file of walk(UPLOADS_DIR)) {
    const rel = path.relative(UPLOADS_DIR, file).split(path.sep).join('/');
    const type = TYPES[path.extname(file).toLowerCase()];
    if (!type) {
      counts.skippedUnknownType++;
      continue;
    }
    const key = uploadKey(rel);
    if (await objectExists(key)) {
      counts.alreadyThere++;
      continue;
    }
    const body = await fs.promises.readFile(file);
    await putObject(key, body, type, body.byteLength);
    counts.disk++;
    console.log(`  uploaded ${key}`);
  }

  const rows = await prisma.storedImage.findMany({ select: { filename: true, mimeType: true, bytes: true } });
  for (const row of rows) {
    const key = uploadKey(row.filename);
    if (await objectExists(key)) {
      counts.alreadyThere++;
      continue;
    }
    const body = Buffer.from(row.bytes);
    await putObject(key, body, row.mimeType, body.byteLength);
    counts.database++;
    console.log(`  uploaded ${key} (from database)`);
  }

  await prisma.$disconnect();
  console.log(`\nDone: ${JSON.stringify(counts)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
