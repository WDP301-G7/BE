// src/constants/roles.ts

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATION: 'OPERATION',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 5,
  [ROLES.MANAGER]: 4,
  [ROLES.OPERATION]: 3,
  [ROLES.STAFF]: 2,
  [ROLES.CUSTOMER]: 1,
} as const;

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Full access
    'users:read',
    'users:write',
    'users:delete',
    'staff:manage',
    'products:read',
    'products:write',
    'products:delete',
    'categories:read',
    'categories:write',
    'categories:delete',
    'orders:read',
    'orders:write',
    'orders:delete',
    'orders:manage',
    'inventory:read',
    'inventory:write',
    'stores:read',
    'stores:write',
    'prescriptions:read',
    'prescriptions:write',
    'payments:read',
    'payments:manage',
    'returns:read',
    'returns:manage',
    'promotions:read',
    'promotions:write',
    'promotions:delete',
    'reports:read',
  ],
  [ROLES.MANAGER]: [
    // Store management
    'users:read',
    'staff:manage',
    'products:read',
    'products:write',
    'categories:read',
    'categories:write',
    'orders:read',
    'orders:write',
    'orders:manage',
    'inventory:read',
    'inventory:write',
    'stores:read',
    'prescriptions:read',
    'prescriptions:write',
    'payments:read',
    'returns:read',
    'returns:manage',
    'promotions:read',
    'reports:read',
  ],
  [ROLES.OPERATION]: [
    // Order processing & operations
    'products:read',
    'orders:read',
    'orders:write',
    'orders:manage',
    'inventory:read',
    'prescriptions:read',
    'prescriptions:write',
    'payments:read',
    'returns:read',
    'returns:write',
  ],
  [ROLES.STAFF]: [
    // Store operations
    'products:read',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'prescriptions:read',
    'prescriptions:write',
    'payments:read',
    'returns:read',
    'returns:write',
  ],
  [ROLES.CUSTOMER]: [
    // Customer access
    'products:read',
    'categories:read',
    'orders:read',
    'orders:write',
    'prescriptions:read',
    'prescriptions:write',
    'profile:read',
    'profile:write',
  ],
} as const;

/**
 * Check if role has permission
 */
export const hasPermission = (role: Role, permission: string): boolean => {
  return ROLE_PERMISSIONS[role].includes(permission as never);
};

/**
 * Check if role has higher or equal hierarchy than target role
 */
export const canManageRole = (managerRole: Role, targetRole: Role): boolean => {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
};
