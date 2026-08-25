/** Admin: homepage CMS (sections + their items). All RBAC-guarded. */
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { HOME_SECTION_TYPES, PRODUCT_CAROUSEL_SOURCES } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, requireStaff, requirePermission, type AuthedRequest } from '../../middleware/auth';
import { toItemDto, toSectionDto } from '../catalog/home.service';

export const adminContentRouter = Router();
adminContentRouter.use(requireAuth, requireStaff);

const audit = (actorId: string, action: string, entity: string, entityId?: string, detail?: unknown) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, detail: detail as never } }).catch(() => undefined);

const itemsInclude = { items: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] } };

/** PRODUCT_CAROUSEL settings; unknown keys are kept so new types can add their own. */
const configSchema = z
  .object({
    source: z.enum(PRODUCT_CAROUSEL_SOURCES).optional(),
    categorySlug: z.string().max(100).optional(),
    productIds: z.array(z.string().min(1)).max(24).optional(),
    limit: z.number().int().min(1).max(24).optional(),
  })
  .passthrough();

const sectionBody = z.object({
  type: z.enum(HOME_SECTION_TYPES),
  title: z.string().max(160).nullable().optional(),
  subtitle: z.string().max(240).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  config: configSchema.nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

const itemBody = z.object({
  imageUrl: z.string().max(500).nullable().optional(),
  mobileImageUrl: z.string().max(500).nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  subtitle: z.string().max(240).nullable().optional(),
  ctaLabel: z.string().max(60).nullable().optional(),
  href: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

const idsBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

/** A section's window must make sense before it is published. */
function assertWindow(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw ApiError.badRequest('The schedule end must be after the start');
  }
}

// --- Sections ---------------------------------------------------------------

adminContentRouter.get(
  '/home-sections',
  requirePermission('content.read'),
  asyncHandler(async (_req, res) => {
    const sections = await prisma.homeSection.findMany({
      include: itemsInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    ok(res, sections.map(toSectionDto));
  }),
);

adminContentRouter.post(
  '/home-sections',
  requirePermission('content.write'),
  validate({ body: sectionBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { config, ...body } = req.body as z.infer<typeof sectionBody>;
    assertWindow(body.startsAt, body.endsAt);
    // New sections land at the bottom of the stack unless placed explicitly.
    const sortOrder = body.sortOrder ?? ((await prisma.homeSection.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
    const section = await prisma.homeSection.create({
      data: { ...body, sortOrder, config: config == null ? Prisma.DbNull : (config as Prisma.InputJsonValue) },
      include: itemsInclude,
    });
    await audit(user.id, 'homeSection.create', 'homeSection', section.id, { type: section.type });
    ok(res, toSectionDto(section), 201);
  }),
);

adminContentRouter.patch(
  '/home-sections/:id',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }), body: sectionBody.partial() }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { config, ...body } = req.body as Partial<z.infer<typeof sectionBody>>;
    const current = await prisma.homeSection.findUnique({ where: { id: req.params.id } });
    if (!current) throw ApiError.notFound('Section not found');
    assertWindow(
      body.startsAt === undefined ? current.startsAt : body.startsAt,
      body.endsAt === undefined ? current.endsAt : body.endsAt,
    );
    const section = await prisma.homeSection.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...(config !== undefined ? { config: config === null ? Prisma.DbNull : (config as Prisma.InputJsonValue) } : {}),
      },
      include: itemsInclude,
    });
    await audit(user.id, 'homeSection.update', 'homeSection', section.id, { ...body, config });
    ok(res, toSectionDto(section));
  }),
);

adminContentRouter.delete(
  '/home-sections/:id',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await prisma.homeSection.delete({ where: { id: req.params.id } }); // items cascade
    await audit(user.id, 'homeSection.delete', 'homeSection', req.params.id);
    ok(res, { deleted: true });
  }),
);

adminContentRouter.post(
  '/home-sections/reorder',
  requirePermission('content.write'),
  validate({ body: idsBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { ids } = req.body as z.infer<typeof idsBody>;
    const found = await prisma.homeSection.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw ApiError.badRequest('Unknown section id in the reorder list');
    await prisma.$transaction(ids.map((id, i) => prisma.homeSection.update({ where: { id }, data: { sortOrder: i } })));
    await audit(user.id, 'homeSection.reorder', 'homeSection', undefined, { ids });
    const sections = await prisma.homeSection.findMany({
      include: itemsInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    ok(res, sections.map(toSectionDto));
  }),
);

// --- Items ------------------------------------------------------------------

adminContentRouter.post(
  '/home-sections/:id/items',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }), body: itemBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const body = req.body as z.infer<typeof itemBody>;
    const section = await prisma.homeSection.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!section) throw ApiError.notFound('Section not found');
    const sortOrder =
      body.sortOrder ??
      ((await prisma.homeSectionItem.aggregate({ where: { sectionId: section.id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
    const item = await prisma.homeSectionItem.create({ data: { ...body, sortOrder, sectionId: section.id } });
    await audit(user.id, 'homeSectionItem.create', 'homeSectionItem', item.id, { sectionId: section.id });
    ok(res, toItemDto(item), 201);
  }),
);

adminContentRouter.post(
  '/home-sections/:id/items/reorder',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }), body: idsBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { ids } = req.body as z.infer<typeof idsBody>;
    const found = await prisma.homeSectionItem.count({ where: { id: { in: ids }, sectionId: req.params.id } });
    if (found !== ids.length) throw ApiError.badRequest('Unknown item id in the reorder list');
    await prisma.$transaction(ids.map((id, i) => prisma.homeSectionItem.update({ where: { id }, data: { sortOrder: i } })));
    await audit(user.id, 'homeSectionItem.reorder', 'homeSection', req.params.id, { ids });
    const items = await prisma.homeSectionItem.findMany({
      where: { sectionId: req.params.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    ok(res, items.map(toItemDto));
  }),
);

adminContentRouter.patch(
  '/home-section-items/:id',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }), body: itemBody.partial() }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const item = await prisma.homeSectionItem.update({ where: { id: req.params.id }, data: req.body });
    await audit(user.id, 'homeSectionItem.update', 'homeSectionItem', item.id, req.body);
    ok(res, toItemDto(item));
  }),
);

adminContentRouter.delete(
  '/home-section-items/:id',
  requirePermission('content.write'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await prisma.homeSectionItem.delete({ where: { id: req.params.id } });
    await audit(user.id, 'homeSectionItem.delete', 'homeSectionItem', req.params.id);
    ok(res, { deleted: true });
  }),
);
