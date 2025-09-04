#!/usr/bin/env node

/**
 * Script to extend or remove expiration from existing API keys
 * This script helps fix expired API keys by either:
 * 1. Removing expiration (making them non-expiring)
 * 2. Extending expiration by a specified number of days
 * 3. Reactivating expired keys
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list-expired':
      await listExpiredKeys();
      break;
    case 'remove-expiration':
      await removeExpiration(args[1]); // userId (optional)
      break;
    case 'extend':
      await extendKeys(parseInt(args[1]) || 365, args[2]); // days, userId (optional)
      break;
    case 'reactivate':
      await reactivateExpiredKeys(args[1]); // userId (optional)
      break;
    default:
      showUsage();
  }
}

function showUsage() {
  console.log(`
Usage: node scripts/extend-api-keys.js <command> [options]

Commands:
  list-expired                    - List all expired API keys
  remove-expiration [userId]      - Remove expiration from all keys (or specific user's keys)
  extend <days> [userId]          - Extend expiration by specified days (or specific user's keys)
  reactivate [userId]             - Reactivate expired keys and remove expiration (or specific user's keys)

Examples:
  node scripts/extend-api-keys.js list-expired
  node scripts/extend-api-keys.js remove-expiration
  node scripts/extend-api-keys.js extend 365
  node scripts/extend-api-keys.js reactivate
  node scripts/extend-api-keys.js remove-expiration user-id-here
`);
}

async function listExpiredKeys() {
  console.log('🔍 Listing expired API keys...\n');
  
  const expiredKeys = await prisma.userApiKey.findMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      expiresAt: 'desc',
    },
  });

  if (expiredKeys.length === 0) {
    console.log('✅ No expired API keys found!');
    return;
  }

  console.log(`Found ${expiredKeys.length} expired API keys:\n`);
  
  expiredKeys.forEach((key, index) => {
    console.log(`${index + 1}. ${key.name}`);
    console.log(`   User: ${key.user.email} (${key.user.name || 'No name'})`);
    console.log(`   Organization: ${key.organization.name}`);
    console.log(`   Expired: ${key.expiresAt.toISOString()}`);
    console.log(`   Active: ${key.isActive ? 'Yes' : 'No'}`);
    console.log(`   Last used: ${key.lastUsedAt ? key.lastUsedAt.toISOString() : 'Never'}`);
    console.log('');
  });
}

async function removeExpiration(userId = null) {
  console.log('🔧 Removing expiration from API keys...\n');
  
  const whereClause = userId ? { userId } : {};
  
  const result = await prisma.userApiKey.updateMany({
    where: {
      ...whereClause,
      expiresAt: {
        not: null,
      },
    },
    data: {
      expiresAt: null,
      isActive: true, // Also reactivate the keys
    },
  });

  console.log(`✅ Updated ${result.count} API keys to never expire`);
  
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    console.log(`   For user: ${user?.email || 'Unknown'}`);
  } else {
    console.log('   For all users');
  }
}

async function extendKeys(days, userId = null) {
  console.log(`🔧 Extending API keys by ${days} days...\n`);
  
  const whereClause = userId ? { userId } : {};
  
  // Get keys that have expiration dates
  const keysToUpdate = await prisma.userApiKey.findMany({
    where: {
      ...whereClause,
      expiresAt: {
        not: null,
      },
    },
  });

  if (keysToUpdate.length === 0) {
    console.log('ℹ️  No API keys with expiration dates found');
    return;
  }

  // Update each key individually to extend its expiration
  let updatedCount = 0;
  for (const key of keysToUpdate) {
    const newExpirationDate = new Date(key.expiresAt.getTime() + (days * 24 * 60 * 60 * 1000));
    
    await prisma.userApiKey.update({
      where: { id: key.id },
      data: {
        expiresAt: newExpirationDate,
        isActive: true, // Also reactivate if it was deactivated
      },
    });
    
    updatedCount++;
  }

  console.log(`✅ Extended ${updatedCount} API keys by ${days} days`);
  
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    console.log(`   For user: ${user?.email || 'Unknown'}`);
  } else {
    console.log('   For all users');
  }
}

async function reactivateExpiredKeys(userId = null) {
  console.log('🔧 Reactivating expired API keys and removing expiration...\n');
  
  const whereClause = userId ? { userId } : {};
  
  const result = await prisma.userApiKey.updateMany({
    where: {
      ...whereClause,
      OR: [
        {
          expiresAt: {
            lt: new Date(),
          },
        },
        {
          isActive: false,
        },
      ],
    },
    data: {
      expiresAt: null, // Remove expiration
      isActive: true,  // Reactivate
    },
  });

  console.log(`✅ Reactivated ${result.count} API keys and removed their expiration`);
  
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    console.log(`   For user: ${user?.email || 'Unknown'}`);
  } else {
    console.log('   For all users');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
