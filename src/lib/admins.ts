import { prisma } from '@/lib/db';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin';

type LegacyAdmin = {
  id?: string;
  staffId?: string;
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  isDefault?: boolean;
};

const prismaAdmin = () => (prisma as any).admin ?? null;

export async function ensureDefaultAdmin() {
  const adminDelegate = prismaAdmin();

  if (!adminDelegate) {
    return {
      id: 'default',
      name: 'Default Admin',
      username: DEFAULT_ADMIN_USERNAME,
      password: DEFAULT_ADMIN_PASSWORD,
      role: 'System Owner',
      is_default: true,
    };
  }

  return adminDelegate.upsert({
    where: { username: DEFAULT_ADMIN_USERNAME },
    update: {},
    create: {
      name: 'Default Admin',
      username: DEFAULT_ADMIN_USERNAME,
      password: DEFAULT_ADMIN_PASSWORD,
      role: 'System Owner',
      is_default: true,
    },
  });
}

export async function migrateLegacyAdmins() {
  const adminDelegate = prismaAdmin();
  if (!adminDelegate) {
    return;
  }

  await ensureDefaultAdmin();

  const legacySetting = await prisma.setting.findUnique({
    where: { key: 'admins_list' },
  });

  if (!legacySetting?.value) {
    return;
  }

  let legacyAdmins: LegacyAdmin[] = [];

  try {
    const parsed = JSON.parse(legacySetting.value);
    if (Array.isArray(parsed)) {
      legacyAdmins = parsed;
    }
  } catch (error) {
    console.error('Legacy admin parse error:', error);
    return;
  }

  const syntheticStaffIdsToDelete: number[] = [];

  for (const legacyAdmin of legacyAdmins) {
    if (!legacyAdmin?.username) {
      continue;
    }

    if (legacyAdmin.isDefault) {
      await adminDelegate.update({
        where: { username: DEFAULT_ADMIN_USERNAME },
        data: {
          name: legacyAdmin.name || 'Default Admin',
          role: legacyAdmin.role || 'System Owner',
          password: legacyAdmin.password || DEFAULT_ADMIN_PASSWORD,
        },
      });
      continue;
    }

    const username = String(legacyAdmin.username).trim().toLowerCase();
    const existingAdmin = await adminDelegate.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      continue;
    }

    const linkedStaffId = Number(legacyAdmin.staffId);
    const linkedStaff = Number.isFinite(linkedStaffId)
      ? await prisma.staff.findUnique({
          where: { id: linkedStaffId },
        })
      : null;

    await adminDelegate.create({
      data: {
        name: legacyAdmin.name || linkedStaff?.name || username,
        username,
        password: linkedStaff?.password || null,
        role: legacyAdmin.role || 'Administrator',
        is_default: false,
      },
    });

    if (
      linkedStaff &&
      !linkedStaff.trn &&
      !linkedStaff.employee_id &&
      !linkedStaff.nis_number &&
      !linkedStaff.phone &&
      !linkedStaff.email
    ) {
      syntheticStaffIdsToDelete.push(linkedStaff.id);
    }
  }

  if (syntheticStaffIdsToDelete.length > 0) {
    await prisma.staff.deleteMany({
      where: {
        id: {
          in: syntheticStaffIdsToDelete,
        },
      },
    });
  }
}

export async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyStoredPassword(inputPassword: string, storedPassword: string | null) {
  if (!storedPassword) {
    return false;
  }

  if (storedPassword === inputPassword) {
    return true;
  }

  const hashedPassword = await hashPassword(inputPassword);
  return storedPassword === hashedPassword;
}
